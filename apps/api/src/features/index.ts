import { DnsModule } from './dns/dns.module.js';
import { HttpHeadersModule } from './http-headers/http-headers.module.js';
import { PortsModule } from './ports/ports.module.js';
import { SubdomainsModule } from './subdomains/subdomains.module.js';
import { SystemModule } from './system/system.module.js';
import { TlsModule } from './tls/tls.module.js';
import { WhoisModule } from './whois/whois.module.js';
import { WifiModule } from './wifi/wifi.module.js';

/** Register new feature modules here. */
export const FEATURE_MODULES = [
  SystemModule,
  DnsModule,
  WhoisModule,
  SubdomainsModule,
  HttpHeadersModule,
  TlsModule,
  PortsModule,
  WifiModule,
];
