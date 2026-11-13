import type { TechDetection } from '@recon/shared';
import { SIGNATURES, type Signature } from './signatures.js';

export interface FingerprintInput {
  /** Lowercase header names. */
  headers: Record<string, string>;
  cookieNames: string[];
  /** Empty for non-HTML responses. */
  html: string;
}

const clip = (s: string, n = 100) => (s.length > n ? `${s.slice(0, n)}...` : s);

export function extractGenerator(html: string): string | undefined {
  const tag = /<meta\b[^>]*\bname\s*=\s*["']generator["'][^>]*>/i.exec(
    html,
  )?.[0];
  return tag
    ? /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]?.trim()
    : undefined;
}

export function extractTitle(html: string): string | undefined {
  const raw = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  return raw
    ? clip(decodeEntities(raw).replace(/\s+/g, ' ').trim(), 200) || undefined
    : undefined;
}

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] !== '#') return NAMED[e.toLowerCase()] ?? m;
    const code =
      e[1] === 'x' || e[1] === 'X'
        ? parseInt(e.slice(2), 16)
        : Number(e.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
  });
}

/** Matches all signatures against one response. Pure: no network. */
export function detectTechnologies(
  input: FingerprintInput,
  signatures: Signature[] = SIGNATURES,
): TechDetection[] {
  const generator = extractGenerator(input.html);
  const found = new Map<string, TechDetection>();

  const add = (
    sig: Signature,
    confidence: TechDetection['confidence'],
    evidence: string,
    version?: string,
  ) => {
    const d = found.get(sig.name);
    if (!d) {
      found.set(sig.name, {
        name: sig.name,
        category: sig.category,
        version,
        confidence,
        evidence: [evidence],
      });
      return;
    }
    d.version ??= version;
    if (confidence === 'high') d.confidence = 'high';
    if (d.evidence.length < 5 && !d.evidence.includes(evidence))
      d.evidence.push(evidence);
  };

  for (const sig of signatures) {
    for (const [name, re] of Object.entries(sig.headers ?? {})) {
      const value = input.headers[name];
      const m = value !== undefined ? re.exec(value) : null;
      if (m) add(sig, 'high', `header ${name}: ${clip(value!)}`, m[1]);
    }
    if (sig.generator && generator) {
      const m = sig.generator.exec(generator);
      if (m) add(sig, 'high', `meta generator: ${clip(generator)}`, m[1]);
    }
    if (sig.cookies) {
      const cookie = input.cookieNames.find((c) => sig.cookies!.test(c));
      if (cookie) add(sig, 'medium', `cookie ${cookie}`);
    }
    for (const re of sig.html ?? []) {
      const m = input.html ? re.exec(input.html) : null;
      if (m) add(sig, 'medium', `html: ${clip(m[0], 80)}`, m[1]);
    }
  }

  // Resolve implications (transitively), without overriding real evidence.
  const byName = new Map(signatures.map((s) => [s.name, s]));
  const queue = [...found.keys()];
  while (queue.length) {
    const sig = byName.get(queue.shift()!);
    for (const implied of sig?.implies ?? []) {
      const target = byName.get(implied);
      if (!target || found.has(implied)) continue;
      add(target, 'medium', `implied by ${sig!.name}`);
      queue.push(implied);
    }
  }

  return [...found.values()].sort(
    (a, b) =>
      a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}
