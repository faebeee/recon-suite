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
    if (size > maxBytes) {
      await res.body.cancel();
      throw new PayloadTooLargeException(
        `Upstream response exceeded ${Math.round(maxBytes / 1024 / 1024)} MB`,
      );
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
