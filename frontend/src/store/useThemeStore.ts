import { create } from 'zustand';

// Task 67, Phase 9.6: light / dark / system theme.
//
// `preference` is what the user chose ('system' follows the device);
// `resolved` is the theme actually applied ('light' | 'dark'). The resolved
// theme is written to <html data-theme="..."> - index.css switches every
// color token on that attribute, so no component needs to know the theme.
//
// The first paint is handled by the inline script in index.html (same
// storage key, same resolution rule) so the page never flashes the wrong
// theme; this store takes over once the app boots.

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

// Must match the key read by the inline script in index.html.
const STORAGE_KEY = 'vysvi-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

// Storage can throw or be empty (private windows, blocked site data) - the
// app must still render, just without remembering the choice.
const readPreference = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // ignore - fall through to the default
  }
  return 'system';
};

const writePreference = (preference: ThemePreference) => {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // ignore - the choice just won't survive a reload
  }
};

// Turns a preference into the theme to show. 'system' asks the device.
const resolveTheme = (preference: ThemePreference): ResolvedTheme => {
  if (preference === 'light' || preference === 'dark') return preference;
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
};

// Applies a resolved theme to the document: the data-theme attribute drives
// the CSS tokens, and color-scheme makes native UI (scrollbars, form
// controls, autofill) match.
const applyTheme = (resolved: ResolvedTheme) => {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
};

// The order the navbar toggle cycles through.
const CYCLE: ThemePreference[] = ['system', 'light', 'dark'];

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  cyclePreference: () => void;
}

const initialPreference = readPreference();

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: initialPreference,
  resolved: resolveTheme(initialPreference),

  // Saves the choice, resolves it and applies it.
  setPreference: (preference) => {
    writePreference(preference);
    const resolved = resolveTheme(preference);
    applyTheme(resolved);
    set({ preference, resolved });
  },

  // system -> light -> dark -> system.
  cyclePreference: () => {
    const next = CYCLE[(CYCLE.indexOf(get().preference) + 1) % CYCLE.length];
    get().setPreference(next);
  },
}));

// Call once at startup (main.tsx): applies the stored theme and, while the
// preference is 'system', re-applies whenever the device's light/dark mode
// changes (e.g. the OS schedules dark mode at sunset).
export const initTheme = () => {
  applyTheme(useThemeStore.getState().resolved);

  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', () => {
    const { preference } = useThemeStore.getState();
    if (preference !== 'system') return;
    const resolved = resolveTheme('system');
    applyTheme(resolved);
    useThemeStore.setState({ resolved });
  });
};
