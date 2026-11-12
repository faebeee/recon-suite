import { z } from 'zod';
import { domainSchema } from '../common/target.js';

export const DNS_RECORD_TYPES = [
  'A',
  'AAAA',
  'CNAME',
  'MX',
  'NS',
  'TXT',
  'SOA',
  'CAA',
] as const;
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

export const DNS_RESOLVERS = {
  cloudflare: ['1.1.1.1', '1.0.0.1'],
  google: ['8.8.8.8', '8.8.4.4'],
  quad9: ['9.9.9.9', '149.112.112.112'],
  system: [],
} as const satisfies Record<string, readonly string[]>;
export type DnsResolver = keyof typeof DNS_RESOLVERS;

export const dnsInputSchema = z.object({
  target: domainSchema,
  types: z
    .array(z.enum(DNS_RECORD_TYPES))
    .min(1)
    .default([...DNS_RECORD_TYPES]),
  resolver: z
    .enum(Object.keys(DNS_RESOLVERS) as [DnsResolver, ...DnsResolver[]])
    .default('cloudflare'),
});
export type DnsInput = z.input<typeof dnsInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type DnsParams = z.output<typeof dnsInputSchema>;

export interface DnsRecordSet {
  type: DnsRecordType;
  values: string[];
  /** Set when the query failed for a reason other than "no data". */
  error?: string;
}

export interface DnsOutput {
  resolver: DnsResolver;
  servers: string[];
  records: DnsRecordSet[];
}
