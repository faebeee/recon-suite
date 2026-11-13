import { PayloadTooLargeException } from '@nestjs/common';
import type { Response } from 'undici';

/** Reads a response body as text, aborting once `maxBytes` is exceeded. */
export async function readTextLimited(
  res: Response,
  maxBytes: number,
): Promise<string> {
  if (!res.body) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.byteLength;
    // Leaving the loop releases the reader and cancels the stream; calling
    // res.body.cancel() in here would throw because the stream is locked.
    if (size > maxBytes) break;
    chunks.push(chunk);
  }
  if (size > maxBytes) {
    throw new PayloadTooLargeException(
      `Upstream response exceeded ${formatBytes(maxBytes)}`,
    );
  }
  return Buffer.concat(chunks).toString('utf8');
}

function formatBytes(n: number): string {
  return n >= 1024 * 1024
    ? `${Math.round(n / 1024 / 1024)} MB`
    : `${Math.round(n / 1024)} KB`;
}

/** Reads at most `maxBytes` of a body as text and reports whether the rest was dropped. */
export async function readTextPrefix(
  res: Response,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) return { text: '', truncated: false };
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  // `break` releases the reader and cancels the rest of the stream.
  for await (const chunk of res.body) {
    const room = maxBytes - size;
    if (chunk.byteLength >= room) {
      chunks.push(chunk.subarray(0, room));
      truncated = chunk.byteLength > room;
      break;
    }
    chunks.push(chunk);
    size += chunk.byteLength;
  }
  // A cut may split a multi-byte character; the decoder replaces it, which is harmless here.
  return { text: Buffer.concat(chunks).toString('utf8'), truncated };
}
