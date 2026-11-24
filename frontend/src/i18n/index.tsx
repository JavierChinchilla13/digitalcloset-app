import { Fragment, useMemo, type ReactNode } from 'react';
import { create } from 'zustand';
import { shell } from './areas/shell';
import { auth } from './areas/auth';
import { landing } from './areas/landing';
import { settings } from './areas/settings';
import { closet } from './areas/closet';
import { shared } from './areas/shared';
import { parts } from './areas/parts';
import { serverErrors } from './areas/serverErrors';
import { studio } from './areas/studio';
import { categories } from './areas/categories';
import { persona } from './areas/persona';
import { outfits } from './areas/outfits';
import { garment } from './areas/garment';

// The site's language: English by default, Spanish (neutral Latin American, informal "tú") on request. The choice is kept in this browser's
// localStorage only (no account field, no server, no personal data) and sets <html lang>. A tiny typed dictionary instead of a library:
// see define.ts. Texts are found by a flat key; {name} placeholders are filled in and <tag>..</tag> markers become React nodes.

export type Language = 'en' | 'es';

export const LANGUAGE_STORAGE_KEY = 'vysvi-language';

const AREAS = [shell, auth, landing, settings, closet, shared, parts, garment, outfits, persona, categories, studio, serverErrors];

// Every English text and every Spanish text, merged. (Exported for the parity test.)
export const dictionaries: Record<Language, Record<string, string>> = {
  en: Object.assign({}, ...AREAS.map((a) => a.en)),
  es: Object.assign({}, ...AREAS.map((a) => a.es)),
};

export type MessageKey =
  | keyof typeof shell.en
  | keyof typeof auth.en
  | keyof typeof landing.en
  | keyof typeof settings.en
  | keyof typeof closet.en
  | keyof typeof shared.en
  | keyof typeof parts.en
  | keyof typeof garment.en
  | keyof typeof outfits.en
  | keyof typeof persona.en
  | keyof typeof categories.en
  | keyof typeof studio.en
  | keyof typeof serverErrors.en;

const readStoredLanguage = (): Language => {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'es' || stored === 'en') return stored;
  } catch {
    // storage blocked: English, and the choice just will not survive a reload
  }
  return 'en';
};

const applyLanguage = (language: Language) => {
  document.documentElement.lang = language;
};

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
}

export const useLanguageStore = create<LanguageState>((set, get) => {
  const initial = readStoredLanguage();
  applyLanguage(initial);
  return {
    language: initial,
    setLanguage: (language) => {
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      } catch {
        // ignore
      }
      applyLanguage(language);
      set({ language });
    },
    toggleLanguage: () => get().setLanguage(get().language === 'en' ? 'es' : 'en'),
  };
});

type Params = Record<string, string | number>;

function lookup(language: Language, key: MessageKey, params?: Params): string {
  // A key missing from Spanish (the parity test prevents it) falls back to English rather than showing the key.
  let text = dictionaries[language][key] ?? dictionaries.en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}

// For code that is not a component (messages built in utilities, toasts...): reads the language at the moment of the call.
export function translate(key: MessageKey, params?: Params): string {
  return lookup(useLanguageStore.getState().language, key, params);
}

// Turns "Read the <terms>Terms</terms> and the <privacy>Privacy Policy</privacy>." into React nodes: each <tag>content</tag> is passed
// to the function of the same name in `components` (content as its argument); everything else stays text.
export function renderRich(text: string, components: Record<string, (content: string) => ReactNode>): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /<([a-z]+)>(.*?)<\/\1>/gs;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(<Fragment key={`t${index}`}>{text.slice(last, match.index)}</Fragment>);
    const make = components[match[1]];
    parts.push(<Fragment key={`c${index}`}>{make ? make(match[2]) : match[2]}</Fragment>);
    last = match.index + match[0].length;
    index++;
  }
  if (last < text.length) parts.push(<Fragment key={`t${index}`}>{text.slice(last)}</Fragment>);
  return parts;
}

// The hook components use: re-renders when the language changes.
export function useT() {
  const language = useLanguageStore((state) => state.language);
  // t.rich('key', { terms: (text) => <Link ...>{text}</Link> })
  // One function per language (not a new one every render), so a component can list `t` in a hook's dependencies.
  const t = useMemo(
    () =>
      Object.assign((key: MessageKey, params?: Params) => lookup(language, key, params), {
        rich: (key: MessageKey, components: Record<string, (content: string) => ReactNode>, params?: Params) =>
          renderRich(lookup(language, key, params), components),
      }),
    [language],
  );
  return { t, language };
}
