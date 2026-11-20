import {
  decodeDataUrl,
  looksLikeImage,
  parseIconLinks,
} from './favicon-hash.parser.js';

describe('parseIconLinks', () => {
  it('finds icon links in any attribute style and resolves them', () => {
    const html = `
      <link rel="stylesheet" href="/a.css">
      <link href='/static/fav.png' rel='shortcut icon'>
      <LINK REL=icon HREF=//cdn.x.test/i.svg>
      <link rel="apple-touch-icon" href="https://x.test/touch.png">
      <link rel="icon" href="javascript:alert(1)">
      <link rel="icon" href="data:image/png;base64,iVBORw0KGgo=">`;
    expect(parseIconLinks(html, 'https://x.test/app/')).toEqual([
      'https://x.test/static/fav.png',
      'https://cdn.x.test/i.svg',
      'https://x.test/touch.png',
      'data:image/png;base64,iVBORw0KGgo=',
    ]);
  });
});

describe('decodeDataUrl', () => {
  it('decodes base64 data URLs only', () => {
    expect(decodeDataUrl('data:image/png;base64,aGk=')).toEqual({
      bytes: Buffer.from('hi'),
      contentType: 'image/png',
    });
    expect(decodeDataUrl('data:image/svg+xml,<svg/>')).toBeNull();
  });
});

describe('looksLikeImage', () => {
  const b = (hex: string) => Buffer.from(hex, 'hex');
  it('accepts images by magic bytes or content type', () => {
    expect(looksLikeImage(b('0000010001001010'))).toBe(true);
    expect(looksLikeImage(b('89504e470d0a1a0a'))).toBe(true);
    expect(looksLikeImage(Buffer.from('<svg xmlns="...">'))).toBe(true);
    expect(looksLikeImage(b('0102'), 'image/x-icon')).toBe(true);
  });
  it('rejects catch-all HTML even when served as an image', () => {
    expect(
      looksLikeImage(Buffer.from('<!DOCTYPE html><html>'), 'image/x-icon'),
    ).toBe(false);
    expect(looksLikeImage(Buffer.from('not found'), 'text/plain')).toBe(false);
    expect(looksLikeImage(new Uint8Array())).toBe(false);
  });
});
