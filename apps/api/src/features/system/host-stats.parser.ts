import type { NetworkInterfaceInfo } from 'node:os';
import type {
  ConnectivityCheck,
  HostInterface,
  InternetStatus,
} from '@recon/shared';

const NO_MAC = '00:00:00:00:00:00';

/** fe80::/10 and 169.254.0.0/16: only valid on the local link. */
const isLinkLocal = (address: string) =>
  /^fe[89ab][0-9a-f]:/i.test(address) || address.startsWith('169.254.');

/**
 * External, non-loopback interfaces with at least one routable address (from
 * os.networkInterfaces()), the default-route interface first, then by name. Interfaces with
 * only link-local addresses (macOS awdl0, llw0, utun*) are left out unless they are the default.
 */
export function mapInterfaces(
  raw: NodeJS.Dict<NetworkInterfaceInfo[]>,
  defaultInterface?: string,
): HostInterface[] {
  const out: HostInterface[] = [];
  for (const [name, infos] of Object.entries(raw)) {
    const external = (infos ?? []).filter((i) => !i.internal);
    if (!external.length) continue;
    if (
      name !== defaultInterface &&
      external.every((i) => isLinkLocal(i.address))
    ) {
      continue;
    }
    const mac = external.find((i) => i.mac && i.mac !== NO_MAC)?.mac;
    out.push({
      name,
      mac: mac?.toLowerCase(),
      addresses: external.map((i) => ({
        address: i.address,
        family: i.family === 'IPv6' ? 6 : 4,
        cidr: i.cidr ?? i.address,
      })),
      isDefault: name === defaultInterface,
    });
  }
  return out.sort(
    (a, b) =>
      Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name),
  );
}

export interface Gateway {
  address: string;
  interface?: string;
}

/** macOS `route -n get default`: "gateway: 192.168.1.1" / "interface: en0". */
export function parseMacRoute(text: string): Gateway | undefined {
  const address = /^\s*gateway:\s*(\S+)/m.exec(text)?.[1];
  if (!address) return undefined;
  return { address, interface: /^\s*interface:\s*(\S+)/m.exec(text)?.[1] };
}

/** Linux `ip -j route show default`: [{"dst":"default","gateway":"10.0.0.1","dev":"eth0"}]. */
export function parseIpRouteJson(text: string): Gateway | undefined {
  try {
    const routes = JSON.parse(text) as unknown;
    if (!Array.isArray(routes)) return undefined;
    for (const r of routes as { gateway?: unknown; dev?: unknown }[]) {
      if (typeof r.gateway === 'string') {
        return {
          address: r.gateway,
          interface: typeof r.dev === 'string' ? r.dev : undefined,
        };
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** Cloudflare `/cdn-cgi/trace`: "key=value" lines (ip, loc, colo, ...). */
export function parseTrace(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

/**
 * macOS `vm_stat`: memory the system can hand out right away (free + inactive + speculative
 * pages). os.freemem() only counts free pages, which makes a Mac look permanently full.
 */
export function parseVmStatAvailable(text: string): number | undefined {
  const pageSize = Number(/page size of (\d+) bytes/.exec(text)?.[1]);
  if (!pageSize) return undefined;
  const pages = (name: string) =>
    Number(new RegExp(`^Pages ${name}:\\s+(\\d+)`, 'm').exec(text)?.[1] ?? NaN);
  const total = pages('free') + pages('inactive') + pages('speculative');
  return Number.isFinite(total) ? total * pageSize : undefined;
}

export function internetStatus(
  dns: ConnectivityCheck,
  https: ConnectivityCheck,
): InternetStatus {
  if (dns.ok && https.ok) return 'online';
  return dns.ok || https.ok ? 'degraded' : 'offline';
}
