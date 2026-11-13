import { HttpException } from '@nestjs/common';
import { TOOL_IDS, type ToolId } from '@recon/shared';

const TOOL_PATH = /^\/api\/tools\/([a-z0-9-]+)\/?(?:\?.*)?$/;

/** Minimal shape of an incoming tool request, as interceptors see it. */
export interface ToolRequest {
  method: string;
  url: string;
  originalUrl?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

/** The tool id of a `POST /api/tools/<id>` request; undefined for anything else. */
export function toolOfRequest(req: ToolRequest): ToolId | undefined {
  if (req.method !== 'POST') return undefined;
  const id = TOOL_PATH.exec(req.originalUrl ?? req.url)?.[1];
  return !!id && (TOOL_IDS as readonly string[]).includes(id)
    ? (id as ToolId)
    : undefined;
}

/** The `target` field of a tool request body, trimmed. */
export function targetOf(body: unknown): string | undefined {
  const t = (body as { target?: unknown } | undefined)?.target;
  return typeof t === 'string' && t.trim() ? t.trim() : undefined;
}

/** HTTP status and human-readable message of an error thrown by a tool handler. */
export function errorOf(err: unknown): { status: number; message: string } {
  if (!(err instanceof Error)) return { status: 500, message: String(err) };
  if (!(err instanceof HttpException)) {
    return { status: 500, message: err.message };
  }
  const res = err.getResponse();
  const msg =
    typeof res === 'object' && res
      ? (res as { message?: unknown }).message
      : res;
  return {
    status: err.getStatus(),
    message: Array.isArray(msg)
      ? msg.join('; ')
      : typeof msg === 'string'
        ? msg
        : err.message,
  };
}
