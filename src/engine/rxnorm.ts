import { findIngredientId } from '../data/medicines';
import type { Medicine } from '../data/types';
import { scoreText } from './match';

/**
 * Live lookup in RxNorm (U.S. National Library of Medicine), a free public
 * database of tens of thousands of medicines and supplements.
 * https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html
 *
 * RxNorm only IDENTIFIES the medicine and its ingredients. Whether it is risky for
 * the user is still decided by MediTrust's own rules table; ingredients without
 * rules are reported as "no verified information yet".
 */

const BASE = 'https://rxnav.nlm.nih.gov/REST';

interface Candidate {
  rxcui: string;
  name?: string;
  score: string;
  source: string;
}

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(Mg|Ml|Mcg|Iu)\b/g, (u) => u.toLowerCase());

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`RxNorm ${res.status}`);
  return res.json() as Promise<T>;
}

async function ingredientsFor(rxcui: string, signal?: AbortSignal): Promise<{ tty: string; ingredients: string[] }> {
  const props = await getJson<{ properties?: { tty: string; name: string } }>(`${BASE}/rxcui/${rxcui}/properties.json`, signal);
  const tty = props.properties?.tty ?? '';
  if (tty === 'IN' || tty === 'PIN') return { tty, ingredients: [props.properties!.name] };
  const rel = await getJson<{ relatedGroup?: { conceptGroup?: { conceptProperties?: { name: string }[] }[] } }>(
    `${BASE}/rxcui/${rxcui}/related.json?tty=IN`,
    signal,
  );
  const names = (rel.relatedGroup?.conceptGroup ?? []).flatMap((g) => g.conceptProperties ?? []).map((c) => c.name);
  return { tty, ingredients: [...new Set(names)] };
}

const FORM_LABEL: Record<string, string> = {
  IN: 'Ingredient',
  PIN: 'Ingredient',
  MIN: 'Combination',
  BN: 'Brand',
  SBD: 'Branded product',
  SCD: 'Product',
  SCDF: 'Product',
  SBDF: 'Branded product',
  SCDG: 'Product',
  SBDG: 'Branded product',
};

/** Convert an RxNorm concept into a MediTrust medicine. Exported for tests. */
export function toMedicine(rxcui: string, name: string, tty: string, ingredientNames: string[]): Medicine {
  const labels: Record<string, string> = {};
  const ids = ingredientNames.map((n) => {
    const known = findIngredientId(n);
    if (known) return known;
    const id = `rxing-${slug(n)}`;
    labels[id] = titleCase(n);
    return id;
  });
  return {
    id: `rx-${rxcui}`,
    brand: titleCase(name),
    generic: ingredientNames.map(titleCase).join(' + ') || titleCase(name),
    strength: '',
    form: FORM_LABEL[tty] ?? 'Medicine',
    ingredients: [...new Set(ids)],
    prescriptionOnly: null,
    source: 'rxnorm',
    ingredientLabels: labels,
  };
}

export async function searchRxNorm(query: string, signal?: AbortSignal, limit = 4): Promise<Medicine[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const data = await getJson<{ approximateGroup?: { candidate?: Candidate[] } }>(
    `${BASE}/approximateTerm.json?term=${encodeURIComponent(q)}&maxEntries=12&option=1`,
    signal,
  );
  const seen = new Set<string>();
  const ranked = (data.approximateGroup?.candidate ?? [])
    .filter((c) => c.name && !seen.has(c.rxcui) && seen.add(c.rxcui))
    // Our own similarity check filters out weak partial matches ("zzqx tonic" -> "Ellis Tonic").
    .map((c) => ({ c, sim: scoreText(q, c.name!) }))
    .filter((x) => x.sim >= 0.5)
    .sort((a, b) => b.sim - a.sim || Number(b.c.score) - Number(a.c.score))
    .slice(0, limit);

  const meds = await Promise.all(
    ranked.map(async ({ c }) => {
      try {
        const { tty, ingredients } = await ingredientsFor(c.rxcui, signal);
        return ingredients.length ? toMedicine(c.rxcui, c.name!, tty, ingredients) : null;
      } catch {
        return null;
      }
    }),
  );
  // One entry per ingredient set: "Coartem", "Coartem Pill" and "Coartem Oral Product" collapse.
  const byIngredients = new Map<string, Medicine>();
  for (const m of meds) {
    if (!m) continue;
    const key = [...m.ingredients].sort().join('|');
    if (!byIngredients.has(key)) byIngredients.set(key, m);
  }
  return [...byIngredients.values()];
}
