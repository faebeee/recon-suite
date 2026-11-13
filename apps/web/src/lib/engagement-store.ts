/**
 * Active engagement id: a tiny external store backed by localStorage. Kept free of other
 * imports so the API client can read it without import cycles.
 */
export const ENGAGEMENT_STORAGE_KEY = 'recon-engagement';

const listeners = new Set<() => void>();

function load(): string | null {
  try {
    return localStorage.getItem(ENGAGEMENT_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

let current: string | null = typeof window === 'undefined' ? null : load();

export function getActiveEngagementId(): string | null {
  return current;
}

export function setActiveEngagementId(id: string | null) {
  if (id === current) return;
  current = id;
  try {
    if (id) localStorage.setItem(ENGAGEMENT_STORAGE_KEY, id);
    else localStorage.removeItem(ENGAGEMENT_STORAGE_KEY);
  } catch {
    // Storage blocked: the choice still applies for this session.
  }
  listeners.forEach((l) => l());
}

export function subscribeActiveEngagement(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Keep tabs in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== ENGAGEMENT_STORAGE_KEY) return;
    current = e.newValue || null;
    listeners.forEach((l) => l());
  });
}
