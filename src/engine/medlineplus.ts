import { INGREDIENTS } from '../data/medicines';
import type { Medicine } from '../data/types';

/**
 * "About this medicine" from MedlinePlus (U.S. National Library of Medicine):
 * a trusted, plain-language source. Free, no key. We find each ingredient's
 * RxNorm ID, then ask MedlinePlus Connect for its consumer summary.
 * https://medlineplus.gov/medlineplus-connect/web-service/
 */

export interface AboutEntry {
  ingredient: string;
  title: string;
  summary: string;
  url: string;
}

const cache = new Map<string, AboutEntry | null>();

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

/** The name RxNorm/MedlinePlus use (e.g. paracetamol -> acetaminophen). */
function lookupName(m: Medicine, ingId: string): { display: string; query: string } {
  const ing = INGREDIENTS[ingId];
  if (ing) return { display: ing.name, query: ing.synonyms?.[0] ?? ing.name };
  const label = m.ingredientLabels?.[ingId] ?? ingId;
  return { display: label, query: label };
}

async function aboutIngredient(display: string, query: string, signal?: AbortSignal): Promise<AboutEntry | null> {
  const key = query.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  const idRes = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(query)}&search=2`, { signal });
  const ids: string[] = (await idRes.json())?.idGroup?.rxnormId ?? [];
  if (!ids.length) {
    cache.set(key, null);
    return null;
  }
  const res = await fetch(
    `https://connect.medlineplus.gov/service?mainSearchCriteria.v.cs=2.16.840.1.113883.6.88&mainSearchCriteria.v.c=${ids[0]}&knowledgeResponseType=application/json&informationRecipient.languageCode.c=en`,
    { signal },
  );
  const entries: { title?: { _value?: string }; summary?: { _value?: string }; link?: { href: string }[] }[] = (await res.json())?.feed?.entry ?? [];
  // The drug page comes first; skip general topic pages if a drug page exists.
  const drug = entries.find((e) => e.link?.[0]?.href.includes('/druginfo/')) ?? entries[0];
  const entry = drug
    ? {
        ingredient: display,
        title: drug.title?._value ?? display,
        summary: stripHtml(drug.summary?._value ?? ''),
        url: (drug.link?.[0]?.href ?? 'https://medlineplus.gov').replace(/\?.*$/, ''),
      }
    : null;
  cache.set(key, entry && entry.summary ? entry : null);
  return cache.get(key)!;
}

export async function aboutMedicine(m: Medicine, signal?: AbortSignal): Promise<AboutEntry[]> {
  const found = await Promise.all(
    m.ingredients.map(async (id) => {
      const { display, query } = lookupName(m, id);
      try {
        return await aboutIngredient(display, query, signal);
      } catch {
        return null;
      }
    }),
  );
  return found.filter((e): e is AboutEntry => !!e);
}

/** First sentences of a summary, for a compact card. */
export function shortSummary(text: string, maxChars = 320): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const end = cut.lastIndexOf('. ');
  return (end > 120 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`).trim();
}
