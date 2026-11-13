import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import {
  ENGAGEMENT_HEADER,
  TOOL_CATALOG,
  TOOL_IDS,
  type ToolId,
  type ToolResult,
} from '@recon/shared';
import {
  catchError,
  from,
  mergeMap,
  Observable,
  switchMap,
  throwError,
} from 'rxjs';
import { EngagementsRepository } from './engagements.repository.js';
import { checkScope } from './scope.js';

const TOOL_PATH = /^\/api\/tools\/([a-z0-9-]+)\/?(?:\?.*)?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Failures that say nothing about the target and are not worth keeping in the history. */
const NOT_RECORDED = new Set([400, 401, 403, 429]);

interface ToolRequest {
  method: string;
  url: string;
  originalUrl?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

/**
 * Engagement integration for every tool endpoint (POST /api/tools/<id>):
 * - without the engagement header: no effect;
 * - with it: rejects unknown/archived engagements, enforces the scope for active tools
 *   (the target and any extra `hosts`), and stores the run (success or upstream failure)
 *   in the engagement's history. The response gets the stored run's id as `runId`.
 */
@Injectable()
export class RunCaptureInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RunCapture');

  constructor(private readonly repo: EngagementsRepository) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<ToolRequest>();
    const tool = TOOL_PATH.exec(req.originalUrl ?? req.url)?.[1];
    const header = req.headers[ENGAGEMENT_HEADER];
    const engagementId = Array.isArray(header) ? header[0] : header;
    if (req.method !== 'POST' || !engagementId || !isToolId(tool))
      return next.handle();

    const startedAt = new Date();
    // Pre-check failures (unknown/archived engagement, out of scope) are not runs: they
    // propagate untouched. Only the tool's own outcome is recorded.
    return from(this.prepare(tool, engagementId, req.body)).pipe(
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
                error: { status, message: messageOf(err) },
              }),
            ).pipe(switchMap(() => throwError(() => err)));
          }),
        ),
      ),
    );
  }

  private async prepare(tool: ToolId, engagementId: string, body: unknown) {
    if (!UUID.test(engagementId))
      throw new BadRequestException('Invalid engagement id');
    const engagement = await this.repo.engagementRow(engagementId);
    if (engagement.status === 'archived') {
      throw new ConflictException(
        `Engagement "${engagement.name}" is archived; reactivate it to record new runs.`,
      );
    }
    const meta = TOOL_CATALOG[tool];
    if (meta.mode !== 'active' || meta.scope !== 'remote') return;

    const rules = await this.repo.scopeRules(engagementId);
    for (const target of targetsOf(body)) {
      const decision = checkScope(rules, target);
      if (!decision.inScope) {
        throw new ForbiddenException(
          `Out of scope for engagement "${engagement.name}": ${decision.reason}.`,
        );
      }
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

const isToolId = (id: string | undefined): id is ToolId =>
  !!id && (TOOL_IDS as readonly string[]).includes(id);

function targetOf(body: unknown): string | undefined {
  const t = (body as { target?: unknown } | undefined)?.target;
  return typeof t === 'string' && t.trim() ? t.trim() : undefined;
}

/** The main target plus extra hosts some tools accept (e.g. takeover `hosts`). */
export function targetsOf(body: unknown): string[] {
  const out: string[] = [];
  const main = targetOf(body);
  if (main) out.push(main);
  const hosts = (body as { hosts?: unknown } | undefined)?.hosts;
  if (Array.isArray(hosts)) {
    for (const h of hosts)
      if (typeof h === 'string' && h.trim()) out.push(h.trim());
  }
  return out;
}

function messageOf(err: Error): string {
  if (err instanceof HttpException) {
    const res = err.getResponse();
    const msg =
      typeof res === 'object' && res
        ? (res as { message?: unknown }).message
        : res;
    if (Array.isArray(msg)) return msg.join('; ');
    return typeof msg === 'string' ? msg : err.message;
  }
  return err.message;
}
