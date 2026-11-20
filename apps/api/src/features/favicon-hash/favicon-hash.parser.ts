/** Icon URLs from <link rel="icon" ...> tags (any rel containing "icon"), resolved. */
export function parseIconLinks(html: string, base: string): string[] {
  const out: string[] = [];
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = attr(tag, 'rel');
    const href = attr(tag, 'href');
    if (!rel || !href || !/\bicon\b/i.test(rel)) continue;
    if (href.startsWith('data:')) {
      out.push(href);
      continue;
    }
    try {
      const url = new URL(href, base);
      if (url.protocol === 'http:' || url.protocol === 'https:')
        out.push(url.href);
    } catch {
      // Ignore malformed hrefs.
    }
  }
  return [...new Set(out)];
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  ).exec(tag);
  const v = m?.[1] ?? m?.[2] ?? m?.[3];
  return v?.trim() || undefined;
}

/** Bytes of a base64 `data:` URL (null for other encodings, which are not icons we hash). */
export function decodeDataUrl(
  url: string,
): { bytes: Uint8Array; contentType: string } | null {
  const m = /^data:([^;,]*)(;[^,]*)?,(.*)$/s.exec(url);
  if (!m || !m[2]?.includes(';base64')) return null;
  return {
    bytes: Buffer.from(m[3] ?? '', 'base64'),
    contentType: m[1] || 'application/octet-stream',
  };
}

/**
 * True when the body looks like an image: an image content type, or ICO/PNG/GIF/JPEG/WebP/SVG
 * magic bytes. Catch-all HTML pages for a missing favicon are not images.
 */
export function looksLikeImage(
  bytes: Uint8Array,
  contentType?: string,
): boolean {
  if (!bytes.length) return false;
  const head = Buffer.from(bytes.subarray(0, 256));
  const text = head.toString('latin1').trimStart().toLowerCase();
  if (text.startsWith('<!doctype html') || text.startsWith('<html'))
    return false;
  if (contentType?.toLowerCase().startsWith('image/')) return true;
  const hex = head.subarray(0, 4).toString('hex');
  return (
    hex === '00000100' || // ICO
    hex === '89504e47' || // PNG
    hex.startsWith('474946') || // GIF
    hex.startsWith('ffd8ff') || // JPEG
    (hex === '52494646' && head.subarray(8, 12).toString() === 'WEBP') ||
    text.startsWith('<svg') ||
    (text.startsWith('<?xml') && text.includes('<svg'))
  );
}
