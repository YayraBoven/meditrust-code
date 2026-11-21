import { useApp } from '../store/useApp';
import dag from './dag.json';
import ewe from './ewe.json';
import gaa from './gaa.json';
import twi from './twi.json';
import strings from './strings.json';

/**
 * Translations are keyed by the English sentence itself. Every sentence was
 * machine-translated ahead of time with GhanaNLP's Khaya API (scripts/translate.ts)
 * and must be checked by a fluent speaker before it is relied on.
 * Missing entries fall back to English.
 */

export type Lang = 'en' | 'twi' | 'ewe' | 'gaa' | 'dag';

export const LANGS: { id: Lang; name: string; native: string; khaya: string; tts: string }[] = [
  { id: 'en', name: 'English', native: 'English', khaya: 'en', tts: 'eng' },
  { id: 'twi', name: 'Twi', native: 'Twi', khaya: 'tw', tts: 'twi' },
  { id: 'ewe', name: 'Ewe', native: 'Eʋegbe', khaya: 'ee', tts: 'ewe' },
  { id: 'gaa', name: 'Ga', native: 'Gã', khaya: 'gaa', tts: 'gaa' },
  { id: 'dag', name: 'Dagbani', native: 'Dagbanli', khaya: 'dag', tts: 'dag' },
];

const TABLES: Record<Exclude<Lang, 'en'>, Record<string, string>> = { twi, ewe, gaa, dag };

export function translate(lang: Lang, english: string): string {
  if (lang === 'en' || !english) return english;
  return TABLES[lang][english] || english;
}

/** Hook: `const t = useT(); t('Check a medicine')`. */
export function useT() {
  const lang = useApp((s) => s.lang);
  return (english: string) => translate(lang, english);
}

/** Share of the app's sentences translated so far (0..1). English is always complete. */
export function coverage(lang: Lang): number {
  if (lang === 'en') return 1;
  const table = TABLES[lang];
  return (strings as string[]).filter((s) => table[s]).length / (strings as string[]).length;
}

export const langInfo = (lang: Lang) => LANGS.find((l) => l.id === lang) ?? LANGS[0];
