import type { z } from 'zod';
import {
  bluetoothInputSchema,
  type BluetoothInput,
  type BluetoothOutput,
} from './features/bluetooth.js';
import {
  wifiInputSchema,
  type WifiInput,
  type WifiOutput,
} from './features/wifi.js';
import type { ToolId } from './common/tool.js';
import {
  dnsInputSchema,
  type DnsInput,
  type DnsOutput,
} from './features/dns.js';
import {
  httpHeadersInputSchema,
  type HttpHeadersInput,
  type HttpHeadersOutput,
} from './features/http-headers.js';
import {
  portsInputSchema,
  type PortsInput,
  type PortsOutput,
} from './features/ports.js';
import {
  subdomainsInputSchema,
  type SubdomainsInput,
  type SubdomainsOutput,
} from './features/subdomains.js';
import {
  tlsInputSchema,
  type TlsInput,
  type TlsOutput,
} from './features/tls.js';
import {
  whoisInputSchema,
  type WhoisInput,
  type WhoisOutput,
} from './features/whois.js';

/** Request schema per tool. Register new tools here. */
export const TOOL_INPUT_SCHEMAS = {
  dns: dnsInputSchema,
  whois: whoisInputSchema,
  subdomains: subdomainsInputSchema,
  'http-headers': httpHeadersInputSchema,
  tls: tlsInputSchema,
  ports: portsInputSchema,
  wifi: wifiInputSchema,
  bluetooth: bluetoothInputSchema,
} as const satisfies Record<ToolId, z.ZodType>;

/** Request/response types per tool. Register new tools here. */
export interface ToolIO {
  dns: { input: DnsInput; output: DnsOutput };
  whois: { input: WhoisInput; output: WhoisOutput };
  subdomains: { input: SubdomainsInput; output: SubdomainsOutput };
  'http-headers': { input: HttpHeadersInput; output: HttpHeadersOutput };
  tls: { input: TlsInput; output: TlsOutput };
  ports: { input: PortsInput; output: PortsOutput };
  wifi: { input: WifiInput; output: WifiOutput };
  bluetooth: { input: BluetoothInput; output: BluetoothOutput };
}

// Compile-time check: every ToolId has an entry in ToolIO.
type _AssertComplete = ToolIO[ToolId];
