const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

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

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(0, ['API unreachable. Is the api service running?']);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const msg = body?.message ?? res.statusText;
    throw new ApiError(res.status, Array.isArray(msg) ? msg : [msg]);
  }
  return res.json() as Promise<T>;
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });
}
