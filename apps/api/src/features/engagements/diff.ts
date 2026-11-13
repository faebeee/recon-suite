export type DiffKind = 'added' | 'removed' | 'changed';

export interface DiffEntry {
  /** JSON path, e.g. "records[2].values" or "headers.server". */
  path: string;
  kind: DiffKind;
  before?: unknown;
  after?: unknown;
}

/** Keys that change on every run and carry no meaning for a comparison. */
const VOLATILE = new Set([
  'durationMs',
  'latencyMs',
  'startedAt',
  'daysRemaining',
]);

const MAX_ENTRIES = 1000;

/**
 * Structural diff of two tool outputs. Arrays of primitives are compared as sets (order
 * changes are noise in recon data, e.g. DNS answers); other arrays index by position.
 */
export function diffValues(before: unknown, after: unknown): DiffEntry[] {
  const out: DiffEntry[] = [];
  walk(before, after, '', out);
  return out.slice(0, MAX_ENTRIES);
}

function walk(a: unknown, b: unknown, path: string, out: DiffEntry[]): void {
  if (out.length >= MAX_ENTRIES) return;
  if (Object.is(a, b)) return;
  if (a === undefined) {
    out.push({ path, kind: 'added', after: b });
    return;
  }
  if (b === undefined) {
    out.push({ path, kind: 'removed', before: a });
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if ([...a, ...b].every(isPrimitive)) {
      const sa = new Set(a);
      const sb = new Set(b);
      for (const v of b)
        if (!sa.has(v)) out.push({ path, kind: 'added', after: v });
      for (const v of a)
        if (!sb.has(v)) out.push({ path, kind: 'removed', before: v });
      return;
    }
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) walk(a[i], b[i], `${path}[${i}]`, out);
    return;
  }
  if (isObject(a) && isObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (VOLATILE.has(k)) continue;
      walk(a[k], b[k], path ? `${path}.${k}` : k, out);
    }
    return;
  }
  out.push({ path, kind: 'changed', before: a, after: b });
}

const isPrimitive = (v: unknown) => v === null || typeof v !== 'object';
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
