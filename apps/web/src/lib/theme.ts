import { useCallback, useSyncExternalStore } from 'react';

/**
 * Visual themes. Each id maps to `:root[data-theme='<id>']` in `src/themes/<id>.css`
 * (the default `cyber` theme lives in `styles.css` on plain `:root`).
 * Keep `THEME_STORAGE_KEY`, the ids, theme colours and light schemes in sync with the
 * inline script in `index.html`, which applies the stored theme before first paint.
 * `scheme: 'light'` themes remove the `dark` class from <html>.
 */
export const THEMES = [
  { id: 'cyber', label: 'Cyber', themeColor: '#0b0b16', scheme: 'dark' },
  { id: 'nothing', label: 'Nothing', themeColor: '#000000', scheme: 'dark' },
  { id: 'mono', label: 'Mono', themeColor: '#ffffff', scheme: 'light' },
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
  const entry = THEMES.find((t) => t.id === id);
  const root = document.documentElement;
  root.dataset.theme = id;
  // shadcn's `dark:` variants key off the .dark class; light themes drop it.
  root.classList.toggle('dark', entry?.scheme !== 'light');
  const color = entry?.themeColor;
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
