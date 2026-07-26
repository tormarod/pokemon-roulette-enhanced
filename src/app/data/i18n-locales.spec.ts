import { RELEASE_NOTES } from './release-notes';

// Importing the locale files here is itself the main assertion: a malformed
// locale file fails the TypeScript/bundler JSON parse, so CI goes red instead
// of shipping it. A missing comma in en.json once reached production and blanked
// the whole app — the translation load blocks bootstrap, so a parse error there
// aborts the render entirely.
// (Suffixed names on purpose: a bare `it` import would shadow Jasmine's `it`.)
import deLocale from '../../assets/i18n/de.json';
import enLocale from '../../assets/i18n/en.json';
import esLocale from '../../assets/i18n/es.json';
import frLocale from '../../assets/i18n/fr.json';
import itLocale from '../../assets/i18n/it.json';
import ptLocale from '../../assets/i18n/pt.json';

const LOCALES: Record<string, unknown> = {
  de: deLocale,
  en: enLocale,
  es: esLocale,
  fr: frLocale,
  it: itLocale,
  pt: ptLocale,
};

function lookup(source: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, segment) =>
      node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined,
    source
  );
}

describe('i18n locale files', () => {
  it('parse as JSON objects', () => {
    for (const [lang, translations] of Object.entries(LOCALES)) {
      expect(typeof translations).withContext(lang).toBe('object');
      expect(Object.keys(translations as object).length).withContext(lang).toBeGreaterThan(0);
    }
  });

  // Guards the other half of the same regression: the What's New note existed in
  // all six locale files but was never listed in RELEASE_NOTES, so it never showed.
  it('define every RELEASE_NOTES note key in every locale', () => {
    for (const release of RELEASE_NOTES) {
      for (const noteKey of release.noteKeys) {
        for (const [lang, translations] of Object.entries(LOCALES)) {
          expect(typeof lookup(translations, noteKey))
            .withContext(`${lang}: ${noteKey} (v${release.version})`)
            .toBe('string');
        }
      }
    }
  });

  // Catches a note added to the locale files but forgotten in RELEASE_NOTES,
  // which is how the 4.0.1 Market note went missing from the modal.
  it('list every whatsNew note of a released version in RELEASE_NOTES', () => {
    const listedKeys = new Set(RELEASE_NOTES.flatMap(release => release.noteKeys));
    const whatsNew = lookup(enLocale, 'whatsNew') as Record<string, unknown>;

    for (const [versionKey, notes] of Object.entries(whatsNew)) {
      if (!versionKey.startsWith('v') || typeof notes !== 'object' || notes === null) {
        continue;
      }
      for (const noteIndex of Object.keys(notes)) {
        expect(listedKeys)
          .withContext(`whatsNew.${versionKey}.${noteIndex} is in en.json but not in RELEASE_NOTES`)
          .toContain(`whatsNew.${versionKey}.${noteIndex}`);
      }
    }
  });
});
