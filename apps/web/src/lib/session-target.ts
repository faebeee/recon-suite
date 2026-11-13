import { useSyncExternalStore } from 'react';

/**
 * Session target: one URL/host/IP the user is working on. Tool pages prefill it (adapted to
 * what the tool accepts, see `targetForTool` in features/registry), so several tools can be
 * run against the same target without retyping it. Kept in sessionStorage: it survives
 * reloads and page changes, and ends with the browser tab.
 */
export const SESSION_TARGET_KEY = 'recon-session-target';

const listeners = new Set<() => void>();

function load(): string | null {
  try {
    return sessionStorage.getItem(SESSION_TARGET_KEY) || null;
  } catch {
    return null;
  }
}

let current: string | null = typeof window === 'undefined' ? null : load();

export function getSessionTarget(): string | null {
  return current;
}

export function setSessionTarget(value: string | null) {
  const next = value?.trim() || null;
  if (next === current) return;
  current = next;
  try {
    if (next) sessionStorage.setItem(SESSION_TARGET_KEY, next);
    else sessionStorage.removeItem(SESSION_TARGET_KEY);
  } catch {
    // Storage blocked: the target still applies until the page is reloaded.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current session target (null when none is set); re-renders on change. */
export function useSessionTarget(): string | null {
  return useSyncExternalStore(subscribe, getSessionTarget, () => null);
}
