import { EngagementsModule } from './engagements/engagements.module.js';
import { LastRunsModule } from './last-runs/last-runs.module.js';
import { ZoneTransferModule } from './zone-transfer/zone-transfer.module.js';
import { DnssecModule } from './dnssec/dnssec.module.js';
import { TakeoverModule } from './takeover/takeover.module.js';
import { CveLookupModule } from './cve-lookup/cve-lookup.module.js';
import { CertSearchModule } from './cert-search/cert-search.module.js';
import { ReverseIpModule } from './reverse-ip/reverse-ip.module.js';
import { CloudStorageModule } from './cloud-storage/cloud-storage.module.js';
import { WaybackModule } from './wayback/wayback.module.js';
import { CorsModule } from './cors/cors.module.js';
import { CookieAuditModule } from './cookie-audit/cookie-audit.module.js';
import { HttpMethodsModule } from './http-methods/http-methods.module.js';
import { TlsAuditModule } from './tls-audit/tls-audit.module.js';
import { JsEndpointsModule } from './js-endpoints/js-endpoints.module.js';
import { ExposedFilesModule } from './exposed-files/exposed-files.module.js';
import { BannerGrabModule } from './banner-grab/banner-grab.module.js';
import { NmapModule } from './nmap/nmap.module.js';
import { NetworkScanModule } from './network-scan/network-scan.module.js';
import { BluetoothModule } from './bluetooth/bluetooth.module.js';
import { DnsModule } from './dns/dns.module.js';
import { EmailSecurityModule } from './email-security/email-security.module.js';
import { HostScanModule } from './host-scan/host-scan.module.js';
import { HttpHeadersModule } from './http-headers/http-headers.module.js';
import { IpIntelModule } from './ip-intel/ip-intel.module.js';
import { PassiveExposureModule } from './passive-exposure/passive-exposure.module.js';
import { DevFootprintModule } from './dev-footprint/dev-footprint.module.js';
import { PortsModule } from './ports/ports.module.js';
import { SubdomainsModule } from './subdomains/subdomains.module.js';
import { SystemModule } from './system/system.module.js';
import { TechFingerprintModule } from './tech-fingerprint/tech-fingerprint.module.js';
import { TlsModule } from './tls/tls.module.js';
import { WebFilesModule } from './web-files/web-files.module.js';
import { WhoisModule } from './whois/whois.module.js';
import { WifiModule } from './wifi/wifi.module.js';

/** Register new feature modules here. */
export const FEATURE_MODULES = [
  SystemModule,
  // Before EngagementsModule: its interceptor must wrap the engagement one (see LastRunInterceptor).
  LastRunsModule,
  EngagementsModule,
  DnsModule,
  WhoisModule,
  SubdomainsModule,
  EmailSecurityModule,
  IpIntelModule,
  PassiveExposureModule,
  DevFootprintModule,
  HttpHeadersModule,
  TlsModule,
  WebFilesModule,
  TechFingerprintModule,
  ZoneTransferModule,
  DnssecModule,
  TakeoverModule,
  CveLookupModule,
  CertSearchModule,
  ReverseIpModule,
  CloudStorageModule,
  WaybackModule,
  CorsModule,
  CookieAuditModule,
  HttpMethodsModule,
  TlsAuditModule,
  JsEndpointsModule,
  ExposedFilesModule,
  BannerGrabModule,
  NmapModule,
  NetworkScanModule,
  PortsModule,
  HostScanModule,
  WifiModule,
  BluetoothModule,
];
