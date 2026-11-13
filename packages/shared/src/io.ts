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
  zoneTransferInputSchema,
  type ZoneTransferInput,
  type ZoneTransferOutput,
} from './features/zone-transfer.js';
import {
  dnssecInputSchema,
  type DnssecInput,
  type DnssecOutput,
} from './features/dnssec.js';
import {
  takeoverInputSchema,
  type TakeoverInput,
  type TakeoverOutput,
} from './features/takeover.js';
import {
  cveLookupInputSchema,
  type CveLookupInput,
  type CveLookupOutput,
} from './features/cve-lookup.js';
import {
  certSearchInputSchema,
  type CertSearchInput,
  type CertSearchOutput,
} from './features/cert-search.js';
import {
  reverseIpInputSchema,
  type ReverseIpInput,
  type ReverseIpOutput,
} from './features/reverse-ip.js';
import {
  cloudStorageInputSchema,
  type CloudStorageInput,
  type CloudStorageOutput,
} from './features/cloud-storage.js';
import {
  waybackInputSchema,
  type WaybackInput,
  type WaybackOutput,
} from './features/wayback.js';
import {
  corsInputSchema,
  type CorsInput,
  type CorsOutput,
} from './features/cors.js';
import {
  tlsAuditInputSchema,
  type TlsAuditInput,
  type TlsAuditOutput,
} from './features/tls-audit.js';
import {
  jsEndpointsInputSchema,
  type JsEndpointsInput,
  type JsEndpointsOutput,
} from './features/js-endpoints.js';
import {
  exposedFilesInputSchema,
  type ExposedFilesInput,
  type ExposedFilesOutput,
} from './features/exposed-files.js';
import {
  bannerGrabInputSchema,
  type BannerGrabInput,
  type BannerGrabOutput,
} from './features/banner-grab.js';
import {
  nmapInputSchema,
  type NmapInput,
  type NmapOutput,
} from './features/nmap.js';
import {
  emailSecurityInputSchema,
  type EmailSecurityInput,
  type EmailSecurityOutput,
} from './features/email-security.js';
import {
  ipIntelInputSchema,
  type IpIntelInput,
  type IpIntelOutput,
} from './features/ip-intel.js';
import {
  techFingerprintInputSchema,
  type TechFingerprintInput,
  type TechFingerprintOutput,
} from './features/tech-fingerprint.js';
import {
  webFilesInputSchema,
  type WebFilesInput,
  type WebFilesOutput,
} from './features/web-files.js';
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
  hostScanInputSchema,
  type HostScanInput,
  type HostScanOutput,
} from './features/host-scan.js';
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
  'email-security': emailSecurityInputSchema,
  'ip-intel': ipIntelInputSchema,
  'web-files': webFilesInputSchema,
  'tech-fingerprint': techFingerprintInputSchema,
  'zone-transfer': zoneTransferInputSchema,
  dnssec: dnssecInputSchema,
  takeover: takeoverInputSchema,
  'cve-lookup': cveLookupInputSchema,
  'cert-search': certSearchInputSchema,
  'reverse-ip': reverseIpInputSchema,
  'cloud-storage': cloudStorageInputSchema,
  wayback: waybackInputSchema,
  cors: corsInputSchema,
  'tls-audit': tlsAuditInputSchema,
  'js-endpoints': jsEndpointsInputSchema,
  'exposed-files': exposedFilesInputSchema,
  'banner-grab': bannerGrabInputSchema,
  nmap: nmapInputSchema,
  'http-headers': httpHeadersInputSchema,
  tls: tlsInputSchema,
  ports: portsInputSchema,
  'host-scan': hostScanInputSchema,
  wifi: wifiInputSchema,
  bluetooth: bluetoothInputSchema,
} as const satisfies Record<ToolId, z.ZodType>;

/** Request/response types per tool. Register new tools here. */
export interface ToolIO {
  dns: { input: DnsInput; output: DnsOutput };
  whois: { input: WhoisInput; output: WhoisOutput };
  subdomains: { input: SubdomainsInput; output: SubdomainsOutput };
  'email-security': { input: EmailSecurityInput; output: EmailSecurityOutput };
  'ip-intel': { input: IpIntelInput; output: IpIntelOutput };
  'web-files': { input: WebFilesInput; output: WebFilesOutput };
  'tech-fingerprint': {
    input: TechFingerprintInput;
    output: TechFingerprintOutput;
  };
  'zone-transfer': { input: ZoneTransferInput; output: ZoneTransferOutput };
  dnssec: { input: DnssecInput; output: DnssecOutput };
  takeover: { input: TakeoverInput; output: TakeoverOutput };
  'cve-lookup': { input: CveLookupInput; output: CveLookupOutput };
  'cert-search': { input: CertSearchInput; output: CertSearchOutput };
  'reverse-ip': { input: ReverseIpInput; output: ReverseIpOutput };
  'cloud-storage': { input: CloudStorageInput; output: CloudStorageOutput };
  wayback: { input: WaybackInput; output: WaybackOutput };
  cors: { input: CorsInput; output: CorsOutput };
  'tls-audit': { input: TlsAuditInput; output: TlsAuditOutput };
  'js-endpoints': { input: JsEndpointsInput; output: JsEndpointsOutput };
  'exposed-files': { input: ExposedFilesInput; output: ExposedFilesOutput };
  'banner-grab': { input: BannerGrabInput; output: BannerGrabOutput };
  nmap: { input: NmapInput; output: NmapOutput };
  'http-headers': { input: HttpHeadersInput; output: HttpHeadersOutput };
  tls: { input: TlsInput; output: TlsOutput };
  ports: { input: PortsInput; output: PortsOutput };
  'host-scan': { input: HostScanInput; output: HostScanOutput };
  wifi: { input: WifiInput; output: WifiOutput };
  bluetooth: { input: BluetoothInput; output: BluetoothOutput };
}

// Compile-time check: every ToolId has an entry in ToolIO.
type _AssertComplete = ToolIO[ToolId];
