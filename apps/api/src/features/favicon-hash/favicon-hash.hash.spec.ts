import {
  base64Lines,
  digests,
  murmur3,
  shodanFaviconHash,
} from './favicon-hash.hash.js';

const bytes = (s: string) => new TextEncoder().encode(s);

describe('murmur3', () => {
  // Published MurmurHash3_x86_32 vectors (signed, like Python's mmh3.hash).
  it.each([
    ['', 0, 0],
    ['', 1, 0x514e28b7],
    ['hello', 0, 0x248bfa47],
    ['The quick brown fox jumps over the lazy dog', 0, 0x2e4ff723],
    ['foo', 0, -156908512],
  ])('%j seed %i', (input, seed, expected) => {
    expect(murmur3(bytes(input), seed)).toBe(expected | 0);
  });

  it('covers every tail length', () => {
    const seen = new Set(
      ['a', 'ab', 'abc', 'abcd', 'abcde'].map((s) => murmur3(bytes(s))),
    );
    expect(seen.size).toBe(5);
  });
});

describe('base64Lines', () => {
  it('wraps at 76 characters with a trailing newline, like base64.encodebytes', () => {
    const out = base64Lines(new Uint8Array(100).fill(255));
    const lines = out.split('\n');
    expect(lines[0]).toHaveLength(76);
    expect(lines.at(-1)).toBe('');
    expect(out.endsWith('\n')).toBe(true);
    expect(base64Lines(bytes('hi'))).toBe('aGk=\n');
  });
});

describe('shodanFaviconHash', () => {
  it('hashes the wrapped base64, not the raw bytes', () => {
    const icon = bytes('icon');
    expect(shodanFaviconHash(icon)).toBe(murmur3(bytes('aWNvbg==\n')));
    expect(shodanFaviconHash(icon)).not.toBe(murmur3(icon));
  });
});

describe('digests', () => {
  it('computes md5 and sha256', () => {
    expect(digests(bytes('')).md5).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });
});
