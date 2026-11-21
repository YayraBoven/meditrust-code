import { INGREDIENTS, MEDICINES } from '../data/medicines';
import type { Medicine } from '../data/types';

/**
 * Medicine matcher. Finds which database entry the user meant. It only ever
 * returns entries that exist in the verified medicine list; it never invents one.
 */

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

function termsFor(m: Medicine): string[] {
  return [m.brand, m.generic, ...m.ingredients.map((i) => INGREDIENTS[i]?.name ?? i), ...(m.aliases ?? [])].map(norm);
}

/** Score 0..1 for how well the query matches one term. */
function scoreTerm(q: string, term: string): number {
  if (!q) return 0;
  if (term === q) return 1;
  if (term.startsWith(q)) return 0.9;
  const words = term.split(' ');
  if (words.some((w) => w.startsWith(q))) return 0.85;
  if (term.includes(q)) return 0.7;
  // Typo tolerance on whole words, e.g. "ibuprofin" -> "ibuprofen".
  if (q.length >= 4) {
    const best = Math.min(...words.map((w) => editDistance(q, w.slice(0, Math.max(q.length, w.length)))));
    const ratio = 1 - best / Math.max(q.length, 1);
    if (ratio >= 0.7) return 0.6 * ratio;
  }
  return 0;
}

export interface MatchResult {
  medicine: Medicine;
  score: number;
}

export function searchMedicines(query: string, limit = 6): MatchResult[] {
  const q = norm(query);
  if (q.length < 2) return [];
  return MEDICINES.map((medicine) => ({ medicine, score: Math.max(...termsFor(medicine).map((t) => scoreTerm(q, t))) }))
    .filter((r) => r.score >= 0.35)
    .sort((a, b) => b.score - a.score || a.medicine.brand.localeCompare(b.medicine.brand))
    .slice(0, limit);
}

/** Confident enough to show a "Confirm your medicine" screen. */
export const CONFIDENT = 0.5;
