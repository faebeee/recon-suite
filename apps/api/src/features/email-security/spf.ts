import type { SpfReport } from '@recon/shared';

/** Returns the TXT strings (chunks joined) at `name`; [] when there are none. */
export type TxtLookup = (name: string) => Promise<string[]>;

export interface SpfTerm {
  qualifier: '+' | '-' | '~' | '?';
  mechanism: string;
  value?: string;
}

export interface ParsedSpf {
  terms: SpfTerm[];
  redirect?: string;
}

/** Mechanisms that cost a DNS lookup (RFC 7208 section 4.6.4). */
const LOOKUP_MECHANISMS = new Set(['include', 'a', 'mx', 'ptr', 'exists']);
const MAX_LOOKUPS = 10;
/** Hard cap on records fetched while walking includes, independent of the RFC limit. */
const MAX_FETCHES = 25;

export const isSpfRecord = (txt: string) => /^v=spf1(\s|$)/i.test(txt.trim());

export function parseSpf(record: string): ParsedSpf {
  const terms: SpfTerm[] = [];
  let redirect: string | undefined;
  for (const raw of record.trim().split(/\s+/).slice(1)) {
    const modifier = /^([a-z][a-z0-9_.-]*)=(.*)$/i.exec(raw);
    if (modifier) {
      if (modifier[1]!.toLowerCase() === 'redirect') redirect = modifier[2];
      continue;
    }
    const m = /^([+\-~?]?)([a-z0-9]+)(?:[:/](.*))?$/i.exec(raw);
    if (!m) continue;
    terms.push({
      qualifier: (m[1] || '+') as SpfTerm['qualifier'],
      mechanism: m[2]!.toLowerCase(),
      value: m[3] || undefined,
    });
  }
  return { terms, redirect };
}

/**
 * Fetches the SPF record of `domain` and walks include:/redirect= to count the DNS
 * lookups a receiver would need. Bounded by MAX_FETCHES and loop detection.
 */
export async function evaluateSpf(
  domain: string,
  txt: TxtLookup,
): Promise<SpfReport> {
  const records = (await txt(domain)).filter(isSpfRecord);
  const report: SpfReport = {
    record: records[0],
    recordCount: records.length,
    lookups: 0,
    includes: [],
    errors: [],
  };
  if (!records[0]) return report;

  const seen = new Set([domain.toLowerCase()]);
  let fetches = 0;

  const walk = async (parsed: ParsedSpf, depth: number): Promise<void> => {
    const children: string[] = [];
    for (const t of parsed.terms) {
      if (LOOKUP_MECHANISMS.has(t.mechanism)) report.lookups++;
      if (t.mechanism === 'include' && t.value) children.push(t.value);
    }
    if (parsed.redirect && !parsed.terms.some((t) => t.mechanism === 'all')) {
      report.lookups++;
      children.push(parsed.redirect);
    }
    for (const child of children) {
      const name = child.toLowerCase();
      if (name.includes('%{')) {
        report.errors.push(`${child}: macro not expanded, lookups not counted`);
        continue;
      }
      if (seen.has(name)) {
        report.errors.push(`${child}: include loop`);
        continue;
      }
      seen.add(name);
      report.includes.push(name);
      if (depth >= MAX_LOOKUPS || ++fetches > MAX_FETCHES) {
        report.errors.push(`${child}: not followed (too many nested includes)`);
        continue;
      }
      let childRecords: string[];
      try {
        childRecords = (await txt(name)).filter(isSpfRecord);
      } catch (err) {
        report.errors.push(
          `${child}: lookup failed (${(err as Error).message})`,
        );
        continue;
      }
      if (childRecords.length !== 1) {
        report.errors.push(
          childRecords.length
            ? `${child}: has ${childRecords.length} SPF records (permerror)`
            : `${child}: has no SPF record (permerror)`,
        );
        continue;
      }
      const parsedChild = parseSpf(childRecords[0]!);
      // A redirect target's `all` becomes the effective policy of the parent.
      if (name === parsed.redirect?.toLowerCase() && !report.all) {
        report.all = findAll(parsedChild);
      }
      await walk(parsedChild, depth + 1);
    }
  };

  const top = parseSpf(records[0]);
  report.all = findAll(top);
  await walk(top, 1);
  return report;
}

function findAll(spf: ParsedSpf): string | undefined {
  const all = spf.terms.find((t) => t.mechanism === 'all');
  return all ? `${all.qualifier}all` : undefined;
}
