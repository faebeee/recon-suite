import { z } from 'zod';
import { hostSchema } from '../common/target.js';

export const whoisInputSchema = z.object({ target: hostSchema });
export type WhoisInput = z.input<typeof whoisInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type WhoisParams = z.output<typeof whoisInputSchema>;

export interface WhoisEvent {
  action: string;
  date: string;
}

export interface WhoisEntity {
  roles: string[];
  name?: string;
  handle?: string;
}

export interface WhoisOutput {
  kind: 'domain' | 'ip';
  /** The object actually found (may be the parent domain of the target). */
  queried: string;
  handle?: string;
  name?: string;
  registrar?: string;
  status: string[];
  events: WhoisEvent[];
  nameservers: string[];
  entities: WhoisEntity[];
  network?: {
    startAddress?: string;
    endAddress?: string;
    cidr?: string[];
    country?: string;
    type?: string;
  };
  source: string;
  raw: unknown;
}
