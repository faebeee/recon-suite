import { z } from 'zod';
import { normalizeHost } from '../common/target.js';
import type { Finding } from '../common/finding.js';

/** Organisation handle as used by GitHub, npm scopes, Docker Hub, ... */
export const ORG_HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{0,38})$/;
const DOMAIN_LIKE_RE =
  /^(?=.{1,253}$)(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;

/** Max repositories/packages/images listed per platform. */
export const MAX_FOOTPRINT_ITEMS = 30;

export const devFootprintInputSchema = z.object({
  /** Organisation handle ("acme") or a domain ("acme.com" -> handle "acme"). */
  target: z
    .string()
    .min(1, 'Target is required')
    .transform(normalizeHost)
    .pipe(
      z
        .string()
        .refine(
          (v) => ORG_HANDLE_RE.test(v) || DOMAIN_LIKE_RE.test(v),
          'Enter an organisation handle (e.g. acme) or a domain (e.g. acme.com)',
        ),
    ),
});
export type DevFootprintInput = z.input<typeof devFootprintInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type DevFootprintParams = z.output<typeof devFootprintInputSchema>;

export const FOOTPRINT_PLATFORMS = [
  'github',
  'gitlab',
  'npm',
  'pypi',
  'dockerhub',
] as const;
export type FootprintPlatform = (typeof FOOTPRINT_PLATFORMS)[number];

export const FOOTPRINT_PLATFORM_LABELS: Record<FootprintPlatform, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  npm: 'npm',
  pypi: 'PyPI',
  dockerhub: 'Docker Hub',
};

/** A repository, package or image. */
export interface FootprintItem {
  name: string;
  url: string;
  description?: string;
  /** Last push/publish/update (ISO). */
  updatedAt?: string;
  archived?: boolean;
  fork?: boolean;
  language?: string;
  stars?: number;
  /** Docker pulls. */
  pulls?: number;
  version?: string;
}

/** Organisation-level account on a platform (never a person's profile). */
export interface FootprintAccount {
  kind: 'organization' | 'user' | 'group' | 'scope' | 'namespace';
  url: string;
  name?: string;
  description?: string;
  website?: string;
  location?: string;
  createdAt?: string;
  /** GitHub: the organisation verified a domain. */
  verified?: boolean;
  publicRepos?: number;
}

/** Unscoped package with exactly the handle's name (npm, PyPI). */
export interface FootprintNamesake {
  name: string;
  url: string;
  version?: string;
  description?: string;
  /** Repository/homepage URLs the package declares. */
  links: string[];
  /** A declared link points at the organisation (GitHub/GitLab handle or domain). */
  linkedToOrg: boolean;
  /** npm: the package is owned by the organisation's npm org. */
  ownedByOrg?: boolean;
}

export interface FootprintPlatformResult {
  platform: FootprintPlatform;
  status: 'found' | 'not-found' | 'error';
  account?: FootprintAccount;
  /** Most recently updated first, at most MAX_FOOTPRINT_ITEMS. */
  items: FootprintItem[];
  /** Total items on the platform when known (may exceed `items.length`). */
  totalItems?: number;
  namesake?: FootprintNamesake | null;
  error?: string;
}

export interface DevFootprintOutput {
  query: string;
  /** Handle that was looked up. */
  handle: string;
  /** The domain the handle was derived from, if the target was a domain. */
  domain?: string;
  platforms: FootprintPlatformResult[];
  findings: Finding[];
}
