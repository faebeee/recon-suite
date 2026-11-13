/**
 * Minimal helpers for well-formed, tool-generated XML (nmap `-oX`). Not a general XML parser:
 * only attribute extraction and entity decoding.
 */

/** Parses `name="value"` pairs of one start tag's attribute text. */
export function xmlAttrs(
  text: string | undefined,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  if (!text) return out;
  for (const m of text.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    out[m[1]!] = decodeXmlEntities(m[2]!);
  }
  return out;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

export function decodeXmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, ref: string) => {
    if (ref[0] === '#') {
      const code =
        ref[1] === 'x' || ref[1] === 'X'
          ? parseInt(ref.slice(2), 16)
          : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    return ENTITIES[ref] ?? whole;
  });
}
