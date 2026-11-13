import { AUTH_ENDPOINTS, ENGAGEMENT_HEADER } from '@recon/shared';
import { getActiveEngagementId } from './engagement-store';
import { AUTH_STATUS_KEY, queryClient } from './query-client';

export const API_BASE: string = import.meta.env.VITE_API_URL ?? '/api';

/** Error thrown for non-2xx API responses; `messages` holds Nest's error messages. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly messages: string[],
  ) {
    super(messages.join('; ') || `Request failed with ${status}`);
    this.name = 'ApiError';
  }
}

/** Calls whose 401 is an expected answer, not a lost session. */
const AUTH_PATHS: string[] = [AUTH_ENDPOINTS.status, AUTH_ENDPOINTS.login];

/** Absolute URL of an API path (for plain links such as file downloads). */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const engagementId = getActiveEngagementId();
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(engagementId ? { [ENGAGEMENT_HEADER]: engagementId } : {}),
        ...init?.headers,
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, ['API unreachable. Is the api service running?']);
  }

  if (!res.ok) {
    if (res.status === 401 && !AUTH_PATHS.includes(path)) {
      void queryClient.invalidateQueries({ queryKey: AUTH_STATUS_KEY });
    }
    const body = (await res.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const msg = body?.message ?? res.statusText;
    throw new ApiError(res.status, Array.isArray(msg) ? msg : [msg]);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function apiPost<T>(
  path: string,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  return apiFetch<T>(path, {
    ...init,
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

/** DELETE; the API answers 204, so this resolves to undefined. */
export function apiDelete(path: string): Promise<void> {
  return apiFetch<void>(path, { method: 'DELETE' });
}
