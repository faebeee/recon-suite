import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { hostname } from 'node:os';
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
import { LastRunsRepository } from './last-runs.repository.js';

/**
 * Stores every `POST /api/tools/<id>` as that tool's last run: `running` before the handler
 * starts, then the result or error. Registered before the engagement interceptor, so it also
 * records engagement rejections (out of scope, archived) and sees the stored `runId`.
 * Storage failures are logged and never break the tool response.
 */
@Injectable()
export class LastRunInterceptor implements NestInterceptor {
  private readonly logger = new Logger('LastRuns');

  constructor(private readonly repo: LastRunsRepository) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<ToolRequest>();
    const tool = toolOfRequest(req);
    if (!tool) return next.handle();

    const id = randomUUID();
    const startedAt = new Date();
    const header = req.headers[ENGAGEMENT_HEADER];
    const engagementId = Array.isArray(header) ? header[0] : header;

    return from(
      this.safely(tool, () =>
        this.repo.start({
          id,
          tool,
          target: targetOf(req.body) ?? hostname(),
          input: req.body,
          startedAt: startedAt.toISOString(),
          engagementId,
        }),
      ),
    ).pipe(
      switchMap(() =>
        next.handle().pipe(
          mergeMap(async (result) => {
            await this.safely(tool, () =>
              this.repo.finish(tool, id, {
                result: result as ToolResult<unknown>,
              }),
            );
            return result;
          }),
          catchError((err: unknown) =>
            from(
              this.safely(tool, () =>
                this.repo.finish(tool, id, {
                  error: errorOf(err),
                  durationMs: Date.now() - startedAt.getTime(),
                }),
              ),
            ).pipe(switchMap(() => throwError(() => err))),
          ),
        ),
      ),
    );
  }

  private async safely(tool: ToolId, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err) {
      this.logger.error(
        `Could not store the last ${tool} run: ${(err as Error).message}`,
      );
    }
  }
}
