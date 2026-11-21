import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { ENGAGEMENT_HEADER, type ToolId, type ToolResult } from '@recon/shared';
import {
  catchError,
  from,
  mergeMap,
  Observable,
  switchMap,
  throwError,
} from 'rxjs';
import {
  errorOf,
  targetOf,
  toolOfRequest,
  type ToolRequest,
} from '../../core/tool-request.js';
import { EngagementsRepository } from './engagements.repository.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Failures that say nothing about the target and are not worth keeping in the history. */
const NOT_RECORDED = new Set([400, 401, 403, 429]);

/**
 * Engagement integration for every tool endpoint (POST /api/tools/<id>):
 * - without the engagement header: no effect;
 * - with it: rejects unknown/archived engagements and stores the run (success or upstream failure)
 *   in the engagement's history. The response gets the stored run's id as `runId`.
 */
@Injectable()
export class RunCaptureInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RunCapture');

  constructor(private readonly repo: EngagementsRepository) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<ToolRequest>();
    const tool = toolOfRequest(req);
    const header = req.headers[ENGAGEMENT_HEADER];
    const engagementId = Array.isArray(header) ? header[0] : header;
    if (!engagementId || !tool) return next.handle();

    const startedAt = new Date();
    // Pre-check failures (unknown/archived engagement) are not runs: they
    // propagate untouched. Only the tool's own outcome is recorded.
    return from(this.prepare(engagementId)).pipe(
      switchMap(() =>
        next.handle().pipe(
          mergeMap(async (result) => {
            const envelope = result as ToolResult<unknown>;
            const runId = await this.save({
              engagementId,
              tool,
              target: envelope.target,
              startedAt: envelope.startedAt,
              durationMs: envelope.durationMs,
              input: req.body,
              result: envelope,
            });
            return runId ? { ...envelope, runId } : envelope;
          }),
          catchError((err: unknown) => {
            const status = err instanceof HttpException ? err.getStatus() : 500;
            if (NOT_RECORDED.has(status) || !(err instanceof Error)) {
              return throwError(() => err);
            }
            return from(
              this.save({
                engagementId,
                tool,
                target: targetOf(req.body) ?? 'local',
                startedAt: startedAt.toISOString(),
                durationMs: Date.now() - startedAt.getTime(),
                input: req.body,
                error: errorOf(err),
              }),
            ).pipe(switchMap(() => throwError(() => err)));
          }),
        ),
      ),
    );
  }

  private async prepare(engagementId: string) {
    if (!UUID.test(engagementId))
      throw new BadRequestException('Invalid engagement id');
    const engagement = await this.repo.engagementRow(engagementId);
    if (engagement.status === 'archived') {
      throw new ConflictException(
        `Engagement "${engagement.name}" is archived; reactivate it to record new runs.`,
      );
    }
  }

  /** Storing a run must never break the tool response. */
  private async save(
    run: Parameters<EngagementsRepository['insertRun']>[0] & { tool: ToolId },
  ) {
    try {
      return await this.repo.insertRun(run);
    } catch (err) {
      this.logger.error(
        `Could not store ${run.tool} run: ${(err as Error).message}`,
      );
      return undefined;
    }
  }
}
