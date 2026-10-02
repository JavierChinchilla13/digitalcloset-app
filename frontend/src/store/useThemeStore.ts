import { create } from 'zustand';

// Task 67 / Task 82: light or dark theme.
//
// The app opens in whatever the device is set to. There is deliberately no
// "system" choice for the user to pick: the toggle only ever shows (and flips
// between) the theme that is actually on screen. `preference` therefore always
// equals `resolved`; it is kept as a separate field only because it is what
// gets saved, and it is only saved once the user clicks the toggle.
//
// Until then nothing is stored and the theme keeps following the device (e.g.
// the OS schedules dark mode at sunset). The resolved theme is written to
// <html data-theme="..."> - index.css switches every color token on that
// attribute, so no component needs to know the theme.
//
// The first paint is handled by the inline script in index.html (same
// storage key, same resolution rule) so the page never flashes the wrong
// theme; this store takes over once the app boots.

export type ThemePreference = 'light' | 'dark';
export type ResolvedTheme = ThemePreference;

// Must match the key read by the inline script in index.html.
export const THEME_STORAGE_KEY = 'vysvi-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

// What the device is currently set to.
const deviceTheme = (): ResolvedTheme =>
  window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';

// The theme the user explicitly chose earlier, or null if they never did.
// Storage can throw or be empty (private windows, blocked site data) - the app
// must still render, just without remembering the choice. An old saved
// 'system' (from before Task 82) counts as "never chose" and follows the device.
const readStoredTheme = (): ThemePreference | null => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore - fall through to the device theme
  }
  return null;
};

const writeStoredTheme = (theme: ThemePreference) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore - the choice just won't survive a reload
  }
};

// Applies a theme to the document: the data-theme attribute drives the CSS
// tokens, and color-scheme makes native UI (scrollbars, form controls,
// autofill) match.
const applyTheme = (resolved: ResolvedTheme) => {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
};

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  togglePreference: () => void;
}

const initialTheme = readStoredTheme() ?? deviceTheme();

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: initialTheme,
  resolved: initialTheme,

  // Saves the choice and applies it. From here on the device is ignored.
  setPreference: (preference) => {
    writeStoredTheme(preference);
    applyTheme(preference);
    set({ preference, resolved: preference });
  },

  // light <-> dark.
  togglePreference: () => {
    get().setPreference(get().resolved === 'dark' ? 'light' : 'dark');
  },
}));

// Call once at startup (main.tsx): applies the starting theme and, until the
// user picks one themselves, re-applies whenever the device's light/dark mode
// changes.
export const initTheme = () => {
  applyTheme(useThemeStore.getState().resolved);

  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', () => {
    if (readStoredTheme()) return; // the user chose - don't override it
    const theme = deviceTheme();
    applyTheme(theme);
    useThemeStore.setState({ preference: theme, resolved: theme });
  });
};
