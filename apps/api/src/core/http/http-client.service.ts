import {
  BadGatewayException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { Agent, fetch, type Response } from 'undici';
import { TargetGuardService } from '../net/target-guard.service.js';
import { followRedirects, type FollowedResponse } from './follow-redirects.js';

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  redirect?: 'follow' | 'manual';
}

const USER_AGENT = 'recon-suite/0.1 (+security-recon)';
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Outbound HTTP for features.
 * - `target*` methods: user-supplied URLs, every connection validated by TargetGuard.
 * - `trusted*` methods: fixed third-party APIs (RDAP, crt.sh) where the target is only data.
 */
@Injectable()
export class HttpClientService implements OnModuleDestroy {
  private readonly guardedAgent: Agent;
  private readonly trustedAgent = new Agent({ connections: 16 });

  constructor(private readonly guard: TargetGuardService) {
    // Certificate problems are reported by the TLS tool; HTTP inspection should still work.
    this.guardedAgent = new Agent({
      connect: { lookup: guard.lookup, rejectUnauthorized: false },
      connections: 16,
    });
  }

  async onModuleDestroy() {
    await Promise.all([this.guardedAgent.close(), this.trustedAgent.close()]);
  }

  /** Request to a user-supplied URL. */
  async target(url: string, opts: RequestOptions = {}): Promise<Response> {
    const { hostname } = new URL(url);
    // Early, readable rejection for IP literals (lookup isn't called for those).
    await this.guard.resolve(hostname.replace(/^\[|\]$/g, ''));
    return this.send(this.guardedAgent, url, opts);
  }

  /**
   * Request to a user-supplied URL, following redirects hop by hop so every hop is guarded.
   * Use this instead of `redirect: 'follow'` for targets.
   */
  targetFollow(
    url: string,
    opts: Omit<RequestOptions, 'redirect'> & { maxRedirects?: number } = {},
  ): Promise<FollowedResponse> {
    const { maxRedirects, ...rest } = opts;
    return followRedirects(
      (u) => this.target(u, { ...rest, redirect: 'manual' }),
      url,
      maxRedirects,
    );
  }

  /** Request to a fixed, trusted third-party API. */
  trusted(url: string, opts: RequestOptions = {}): Promise<Response> {
    return this.send(this.trustedAgent, url, opts);
  }

  async trustedJson<T>(url: string, opts: RequestOptions = {}): Promise<T> {
    const res = await this.trusted(url, {
      ...opts,
      headers: { accept: 'application/json', ...opts.headers },
    });
    if (!res.ok) {
      throw new BadGatewayException(
        `${new URL(url).host} responded ${res.status}`,
      );
    }
    return (await res.json()) as T;
  }

  private async send(
    dispatcher: Agent,
    url: string,
    {
      method = 'GET',
      headers,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      redirect = 'follow',
    }: RequestOptions,
  ): Promise<Response> {
    try {
      return await fetch(url, {
        method,
        redirect,
        dispatcher,
        headers: { 'user-agent': USER_AGENT, ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw toHttpException(err, url);
    }
  }
}

function toHttpException(err: unknown, url: string): Error {
  const host = new URL(url).host;
  const cause = (err as { cause?: { code?: string; message?: string } }).cause;
  if (
    err instanceof Error &&
    (err.name === 'TimeoutError' || err.name === 'AbortError')
  ) {
    return new GatewayTimeoutException(`Request to ${host} timed out`);
  }
  if (cause?.code === 'EBLOCKED') {
    return new ForbiddenException(cause.message);
  }
  return new BadGatewayException(
    `Request to ${host} failed: ${cause?.message ?? (err as Error).message}`,
  );
}
