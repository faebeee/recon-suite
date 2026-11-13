import { useCallback, useSyncExternalStore } from 'react';

/**
 * Visual themes. Each id maps to `:root[data-theme='<id>']` in `src/themes/<id>.css`
 * (the default `cyber` theme lives in `styles.css` on plain `:root`).
 * Keep `THEME_STORAGE_KEY` and the ids in sync with the inline script in `index.html`,
 * which applies the stored theme before first paint.
 */
export const THEMES = [
  { id: 'cyber', label: 'Cyber', themeColor: '#0b0b16' },
  { id: 'nothing', label: 'Nothing', themeColor: '#000000' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'cyber';
export const THEME_STORAGE_KEY = 'recon-theme';

const listeners = new Set<() => void>();

function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

function readTheme(): ThemeId {
  const value = document.documentElement.dataset.theme;
  return isThemeId(value) ? value : DEFAULT_THEME;
}

export function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  const color = THEMES.find((t) => t.id === id)?.themeColor;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', color ?? '');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // Storage blocked (private mode, policy): the theme still applies for this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
  const setTheme = useCallback((id: ThemeId) => applyTheme(id), []);
  return { theme, setTheme };
}
