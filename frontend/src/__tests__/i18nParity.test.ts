import { describe, expect, it } from 'vitest';
import { dictionaries } from '../i18n';

// The English and Spanish dictionaries cannot drift: every key exists in both, with the same {placeholders} and the same <tags>.
// (TypeScript already enforces the keys inside each area file; this checks the merged result at run time, and the placeholders, which the
// compiler cannot see.)
const en = dictionaries.en;
const es = dictionaries.es;

const placeholders = (text: string) => [...text.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]).sort();
const tags = (text: string) => [...text.matchAll(/<\/?([a-z]+)>/g)].map((m) => m[0]).sort();

describe('the English and Spanish dictionaries', () => {
  it('have exactly the same keys', () => {
    const missingInSpanish = Object.keys(en).filter((key) => !(key in es));
    const missingInEnglish = Object.keys(es).filter((key) => !(key in en));
    expect({ missingInSpanish, missingInEnglish }).toEqual({ missingInSpanish: [], missingInEnglish: [] });
  });

  it('have no empty text in either language', () => {
    for (const [language, dictionary] of Object.entries(dictionaries)) {
      for (const [key, text] of Object.entries(dictionary)) {
        expect(text.trim().length, `${language}: ${key} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it('use the same {placeholders} in every pair', () => {
    for (const key of Object.keys(en)) {
      expect(placeholders(es[key] ?? ''), `placeholders of ${key}`).toEqual(placeholders(en[key]));
    }
  });

  it('use the same <tags> in every pair', () => {
    for (const key of Object.keys(en)) {
      expect(tags(es[key] ?? ''), `tags of ${key}`).toEqual(tags(en[key]));
    }
  });

  it('keep the Spanish informal (tú) and free of the formal "usted" forms in the sentences addressed to the person', () => {
    for (const [key, text] of Object.entries(es)) {
      expect(text, key).not.toMatch(/\b(usted|ustedes)\b/i);
    }
  });

  it('are not the same text everywhere: most Spanish sentences differ from the English ones', () => {
    const same = Object.keys(en).filter((key) => en[key] === es[key]);
    // Brand names, short words that are the same in both languages (Admin, Demo, Outfits, Persona...) are fine; a whole untranslated screen is not.
    expect(same.length / Object.keys(en).length).toBeLessThan(0.1);
  });
});
