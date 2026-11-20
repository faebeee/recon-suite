import { createHash } from 'node:crypto';

/** MurmurHash3 x86 32-bit of the bytes, as a signed 32-bit integer (like Python's mmh3.hash). */
export function murmur3(data: Uint8Array, seed = 0): number {
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  let h = seed >>> 0;
  const blocks = data.length >>> 2;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  for (let i = 0; i < blocks; i++) {
    let k = view.getUint32(i * 4, true);
    k = Math.imul(k, c1);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, c2);
    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = (Math.imul(h, 5) + 0xe6546b64) | 0;
  }

  let k = 0;
  const tail = blocks * 4;
  switch (data.length & 3) {
    case 3:
      k ^= data[tail + 2]! << 16;
    // falls through
    case 2:
      k ^= data[tail + 1]! << 8;
    // falls through
    case 1:
      k ^= data[tail]!;
      k = Math.imul(k, c1);
      k = (k << 15) | (k >>> 17);
      k = Math.imul(k, c2);
      h ^= k;
  }

  h ^= data.length;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h | 0;
}

/**
 * Base64 the way Python's `base64.encodebytes` writes it (76-character lines, each ending
 * in a newline), which is what Shodan hashes.
 */
export function base64Lines(data: Uint8Array): string {
  const b64 = Buffer.from(data).toString('base64');
  let out = '';
  for (let i = 0; i < b64.length; i += 76) out += `${b64.slice(i, i + 76)}\n`;
  return out;
}

/** Shodan's `http.favicon.hash`: mmh3 of the line-wrapped base64 of the icon. */
export function shodanFaviconHash(data: Uint8Array): number {
  return murmur3(Buffer.from(base64Lines(data), 'utf8'));
}

export function digests(data: Uint8Array): { md5: string; sha256: string } {
  return {
    md5: createHash('md5').update(data).digest('hex'),
    sha256: createHash('sha256').update(data).digest('hex'),
  };
}
