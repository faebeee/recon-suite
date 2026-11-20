import { Resolver } from 'node:dns/promises';
import {
  arch,
  cpus,
  freemem,
  hostname,
  loadavg,
  networkInterfaces,
  platform,
  release,
  totalmem,
  uptime,
} from 'node:os';
import { Injectable } from '@nestjs/common';
import type { ConnectivityCheck, HostStats } from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { readTextLimited } from '../../core/http/read-limited.js';
import { runCommand } from '../../core/process/run-command.js';
import {
  internetStatus,
  mapInterfaces,
  parseIpRouteJson,
  parseMacRoute,
  parseTrace,
  parseVmStatAvailable,
  type Gateway,
} from './host-stats.parser.js';
import { PlatformDiagnosticsService } from './platform-diagnostics.service.js';

/** Fixed endpoints; nothing user-supplied is ever contacted here. */
const DNS_PROBE_NAME = 'cloudflare.com';
const TRACE_URL = 'https://1.1.1.1/cdn-cgi/trace';
const CHECK_TIMEOUT_MS = 5_000;
/** The internet check makes outbound requests; reuse its result for this long. */
const INTERNET_CACHE_MS = 30_000;

type Internet = HostStats['internet'];

/**
 * Facts about the machine the API runs on: OS, CPU, memory, network
 * interfaces, default gateway, DNS servers and an internet connectivity check.
 */
@Injectable()
export class HostStatsService {
  private internet?: { at: number; value: Promise<Internet> };

  constructor(
    private readonly http: HttpClientService,
    private readonly diagnostics: PlatformDiagnosticsService,
  ) {}

  async stats(): Promise<HostStats> {
    const [gateway, internet, freeBytes] = await Promise.all([
      this.defaultGateway(),
      this.cachedInternet(),
      this.availableMemory(),
    ]);
    const cpuList = cpus();
    const [l1 = 0, l5 = 0, l15 = 0] = loadavg();
    return {
      generatedAt: new Date().toISOString(),
      hostname: hostname(),
      location: this.diagnostics.runtime.api.location,
      os: { platform: platform(), release: release(), arch: arch() },
      uptimeSeconds: Math.round(uptime()),
      loadAverage: [l1, l5, l15],
      cpu: {
        model: cpuList[0]?.model.trim() ?? 'unknown',
        cores: cpuList.length,
      },
      memory: { totalBytes: totalmem(), freeBytes },
      network: {
        interfaces: mapInterfaces(networkInterfaces(), gateway?.interface),
        defaultGateway: gateway,
        dnsServers: new Resolver().getServers(),
      },
      internet,
    };
  }

  private cachedInternet(): Promise<Internet> {
    const now = Date.now();
    if (!this.internet || now - this.internet.at > INTERNET_CACHE_MS) {
      this.internet = { at: now, value: this.checkInternet() };
    }
    return this.internet.value;
  }

  private async checkInternet(): Promise<Internet> {
    const [dns, trace] = await Promise.all([
      this.checkDns(),
      this.checkHttps(),
    ]);
    return {
      status: internetStatus(dns, trace.check),
      dns,
      https: trace.check,
      publicIp: trace.data.ip,
      country: trace.data.loc,
      colo: trace.data.colo,
      checkedAt: new Date().toISOString(),
    };
  }

  private async checkDns(): Promise<ConnectivityCheck> {
    const resolver = new Resolver({ timeout: CHECK_TIMEOUT_MS, tries: 1 });
    const start = performance.now();
    try {
      await resolver.resolve4(DNS_PROBE_NAME);
      return { ok: true, ms: Math.round(performance.now() - start) };
    } catch (err) {
      return {
        ok: false,
        error: `Could not resolve ${DNS_PROBE_NAME}: ${messageOf(err)}`,
      };
    }
  }

  private async checkHttps(): Promise<{
    check: ConnectivityCheck;
    data: Record<string, string>;
  }> {
    const start = performance.now();
    try {
      const res = await this.http.trusted(TRACE_URL, {
        timeoutMs: CHECK_TIMEOUT_MS,
      });
      const text = await readTextLimited(res, 4096);
      const ms = Math.round(performance.now() - start);
      if (!res.ok) {
        return {
          check: { ok: false, ms, error: `1.1.1.1 responded ${res.status}` },
          data: {},
        };
      }
      return { check: { ok: true, ms }, data: parseTrace(text) };
    } catch (err) {
      return { check: { ok: false, error: messageOf(err) }, data: {} };
    }
  }

  /** Available memory; on macOS from vm_stat (fixed command), elsewhere os.freemem(). */
  private async availableMemory(): Promise<number> {
    if (process.platform === 'darwin') {
      try {
        const available = parseVmStatAvailable(
          await runCommand('vm_stat', [], { timeoutMs: 3_000 }),
        );
        if (available !== undefined) return available;
      } catch {
        // fall back below
      }
    }
    return freemem();
  }

  /** Fixed OS commands (no user input); undefined when unknown or unsupported. */
  private async defaultGateway(): Promise<Gateway | undefined> {
    try {
      if (process.platform === 'darwin') {
        return parseMacRoute(
          await runCommand('route', ['-n', 'get', 'default'], {
            timeoutMs: 3_000,
          }),
        );
      }
      if (process.platform === 'linux') {
        return parseIpRouteJson(
          await runCommand('ip', ['-j', 'route', 'show', 'default'], {
            timeoutMs: 3_000,
          }),
        );
      }
    } catch {
      return undefined;
    }
    return undefined;
  }
}

function messageOf(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as { code?: unknown }).code;
    return typeof code === 'string' ? `${err.message} (${code})` : err.message;
  }
  return 'unknown error';
}
