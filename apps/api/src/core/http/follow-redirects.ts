import type { Response } from 'undici';

export interface FollowedResponse {
  res: Response;
  finalUrl: string;
  redirects: number;
}

/**
 * Follows redirects one hop at a time through `send`, so every hop goes through the
 * caller's guarded client (undici's own `redirect: 'follow'` would skip the target guard
 * for IP-literal redirect locations). Only http(s) locations are followed.
 */
export async function followRedirects(
  send: (url: string) => Promise<Response>,
  url: string,
  maxRedirects = 5,
): Promise<FollowedResponse> {
  let current = url;
  for (let redirects = 0; ; redirects++) {
    const res = await send(current);
    const location = res.headers.get('location');
    const isRedirect = res.status >= 300 && res.status < 400 && location;
    if (!isRedirect || redirects >= maxRedirects) {
      return { res, finalUrl: current, redirects };
    }
    const next = new URL(location, current);
    if (next.protocol !== 'http:' && next.protocol !== 'https:') {
      return { res, finalUrl: current, redirects };
    }
    await res.body?.cancel();
    current = next.href;
  }
}
