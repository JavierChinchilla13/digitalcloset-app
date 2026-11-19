// A small typed dictionary, no library. Each area of the app (shell, sign-in pages, settings...) has its own file that calls
// defineMessages(english, spanish). TypeScript then refuses a Spanish object that lacks a key the English one has, or has an extra
// one, so the two cannot drift inside an area; a test (i18nParity.test.ts) checks the merged dictionaries again at run time and also
// checks that the {placeholders} of every pair match.
//
// Keys are flat and dotted ("nav.closet"). A text may contain {name} placeholders, filled by t('key', { name: '...' }), and
// <tag>...</tag> markers for the few places where part of a sentence is a link or is bold (see renderRich).
export function defineMessages<const T extends Record<string, string>>(en: T, es: { [K in keyof T]: string }) {
  return { en, es } as const;
}
