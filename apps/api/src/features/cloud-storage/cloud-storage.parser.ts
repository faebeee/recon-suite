import type { BucketResult, Finding } from '@recon/shared';

export const MAX_CANDIDATES = 30;
export const MAX_SAMPLE_KEYS = 10;

const SUFFIXES = [
  'backup',
  'backups',
  'assets',
  'static',
  'media',
  'uploads',
  'files',
  'data',
  'dev',
  'staging',
  'prod',
  'public',
  'private',
  'logs',
];

const BUCKET_NAME = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

/** First label of the domain without a leading "www." (example.co.uk -> example). */
export function baseName(domain: string): string {
  return (
    domain
      .toLowerCase()
      .replace(/^www\./, '')
      .split('.')[0] ?? ''
  );
}

/** Candidate bucket names derived from the domain plus user-supplied extras. */
export function candidateNames(
  domain: string,
  extraNames: string[] = [],
): string[] {
  const d = domain.toLowerCase().replace(/^www\./, '');
  const base = baseName(d);
  const names = [
    base,
    ...SUFFIXES.map((s) => `${base}-${s}`),
    d.replace(/\./g, '-'),
    ...extraNames.map((n) => n.trim().toLowerCase()),
  ];
  return [...new Set(names.filter((n) => BUCKET_NAME.test(n)))].slice(
    0,
    MAX_CANDIDATES,
  );
}

/** Azure storage account name: 3-24 lowercase letters/digits, or undefined. */
export function azureAccountName(name: string): string | undefined {
  const acct = name.replace(/[-.]/g, '');
  return /^[a-z0-9]{3,24}$/.test(acct) ? acct : undefined;
}

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

function collect(xml: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(re)) {
    if (out.length >= MAX_SAMPLE_KEYS) break;
    out.push(decodeXml(m[1]!));
  }
  return out;
}

/** S3/GCS ListBucketResult keys (max 10). */
export function parseListBucketKeys(xml: string): string[] {
  return collect(xml, /<Key>([^<]*)<\/Key>/g);
}

/** Azure EnumerationResults blob names (max 10). */
export function parseAzureBlobNames(xml: string): string[] {
  return collect(xml, /<Blob>\s*<Name>([^<]*)<\/Name>/g);
}

/** Error code of an S3/GCS/Azure XML error body, e.g. "NoSuchBucket". */
export function xmlErrorCode(xml: string): string | undefined {
  return /<Code>([^<]+)<\/Code>/.exec(xml)?.[1];
}

export interface StateVerdict {
  kind: 'state';
  state: BucketResult['state'];
  sampleKeys?: string[];
}
export type S3Verdict = StateVerdict | { kind: 'redirect' };

/** Interprets an S3 path-style response for a bucket. */
export function interpretS3(status: number, body: string): S3Verdict {
  if (status === 200 && body.includes('<ListBucketResult')) {
    return {
      kind: 'state',
      state: 'public-list',
      sampleKeys: parseListBucketKeys(body),
    };
  }
  const code = xmlErrorCode(body);
  if (status === 301 || code === 'PermanentRedirect')
    return { kind: 'redirect' };
  if (status === 404 || code === 'NoSuchBucket')
    return { kind: 'state', state: 'not-found' };
  if (status === 403 || status === 200)
    return { kind: 'state', state: 'exists-private' };
  return { kind: 'state', state: 'error' };
}

/** Interprets a GCS path-style response for a bucket. */
export function interpretGcs(status: number, body: string): StateVerdict {
  if (status === 200 && body.includes('<ListBucketResult')) {
    return {
      kind: 'state',
      state: 'public-list',
      sampleKeys: parseListBucketKeys(body),
    };
  }
  if (status === 404) return { kind: 'state', state: 'not-found' };
  if (status === 401 || status === 403 || status === 200) {
    return { kind: 'state', state: 'exists-private' };
  }
  return { kind: 'state', state: 'error' };
}

const PROVIDER: Record<BucketResult['provider'], string> = {
  s3: 'Amazon S3',
  gcs: 'Google Cloud Storage',
  azure: 'Azure Blob Storage',
};

export function buildCloudFindings(results: BucketResult[]): Finding[] {
  const findings: Finding[] = [];
  const open = results.filter((r) => r.state === 'public-list');
  for (const r of open) {
    findings.push({
      id: `cloud.public.${r.provider}.${r.name}`,
      status: 'fail',
      title: `Public ${PROVIDER[r.provider]} bucket`,
      message: `Bucket ${r.name} allows anonymous listing. Verify it belongs to the target and restrict access.`,
      value: r.url,
    });
  }
  const priv = results.filter((r) => r.state === 'exists-private');
  if (priv.length) {
    findings.push({
      id: 'cloud.existing',
      status: 'info',
      title: 'Existing private buckets',
      message: `${priv.length} candidate name(s) exist but deny listing. Names are guesses; they may belong to someone else.`,
      value: priv.map((r) => `${r.provider}:${r.name}`).join(', '),
    });
  }
  if (!open.length) {
    findings.push({
      id: 'cloud.public',
      status: 'pass',
      title: 'No public buckets',
      message: 'None of the candidate buckets allows anonymous listing.',
    });
  }
  return findings;
}
