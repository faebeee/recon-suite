import { z } from 'zod';
import { httpUrlSchema } from '../common/target.js';
import type { Finding } from '../common/finding.js';

export const apiDiscoveryInputSchema = z.object({
  target: httpUrlSchema,
});
export type ApiDiscoveryInput = z.input<typeof apiDiscoveryInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type ApiDiscoveryParams = z.output<typeof apiDiscoveryInputSchema>;

/** Endpoints listed per spec (the rest is counted only). */
export const MAX_SPEC_ENDPOINTS = 500;

export type ApiDocKind = 'openapi' | 'swagger-ui' | 'redoc' | 'graphql';

export interface ApiEndpoint {
  method: string;
  path: string;
  summary?: string;
}

export interface ApiSpec {
  url: string;
  format: 'json' | 'yaml';
  /** "OpenAPI 3.0.1" or "Swagger 2.0". */
  version: string;
  title?: string;
  apiVersion?: string;
  servers: string[];
  /** Total operations in the spec (endpoints may be capped). */
  operations: number;
  endpoints: ApiEndpoint[];
  /** Spec declares security schemes (auth) at all. */
  hasSecuritySchemes: boolean;
}

export interface GraphqlEndpoint {
  url: string;
  /** The introspection query was answered with a schema. */
  introspection: boolean;
  queries: string[];
  mutations: string[];
  types?: number;
}

/** Every location tried (found or not), for transparency. */
export interface ApiProbe {
  path: string;
  kind: ApiDocKind;
  status?: number;
  found: boolean;
  error?: string;
}

export interface ApiDiscoveryOutput {
  origin: string;
  specs: ApiSpec[];
  /** Interactive documentation pages (Swagger UI, ReDoc, GraphiQL). */
  docPages: string[];
  graphql: GraphqlEndpoint[];
  probes: ApiProbe[];
  findings: Finding[];
}
