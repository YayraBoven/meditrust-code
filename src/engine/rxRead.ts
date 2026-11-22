import { MEDICINES, findIngredientId } from '../data/medicines';
import type { Medicine } from '../data/types';
import { medicinesFromFacts, toJpeg } from './aiRead';
import { CONFIDENT, searchMedicines } from './match';

/**
 * Prescription reading. The photo goes (through our server) to the AI reader, which
 * returns ONLY the medicine lines, never the patient's or doctor's details. Each
 * clearly written line is matched to a medicine; unclear lines are never guessed:
 * the user is told to ask the pharmacist about them.
 */

export interface RxLine {
  name: string;
  strength: string;
  form: string;
  directions: string;
  legible: 'clear' | 'unclear';
}

export interface RxFacts {
  is_prescription: boolean;
  medicines: RxLine[];
  confidence: 'high' | 'medium' | 'low';
}

export async function aiReadPrescription(source: Blob, timeoutMs = 35000): Promise<RxFacts> {
  const image = await toJpeg(source);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(new URL('api/identify', document.baseURI), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, mode: 'prescription' }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`identify ${res.status}`);
    return (await res.json()) as RxFacts;
  } finally {
    clearTimeout(timer);
  }
}

const num = (s: string) => s.match(/\d+(\.\d+)?/)?.[0];

/**
 * Matches one written line to a medicine, or null when it cannot be matched safely.
 * 1. A medicine (ingredient) name: a plain product with ONLY that ingredient and the
 *    same strength and form; otherwise the medicine exactly as written. Never a
 *    combination product, never a different strength.
 * 2. A brand name from our own list.
 * 3. A known ingredient we have no product for: the medicine as written.
 * 4. Otherwise null: the caller may search the wider database (RxNorm).
 */
export function matchRxLine(line: RxLine): Medicine | null {
  if (line.legible !== 'clear' || line.name.trim().length < 3) return null;
  const want = num(line.strength);
  const byStrength = (list: Medicine[]) => (want ? list.find((m) => num(m.strength) === want) : undefined) ?? list[0];

  const ingredient = findIngredientId(line.name);
  if (ingredient) {
    const single = MEDICINES.filter((m) => m.ingredients.length === 1 && m.ingredients[0] === ingredient);
    const liquid = (m: Medicine) => /syrup|susp|ml/i.test(`${m.form} ${m.strength}`);
    const wantsLiquid = /syrup|susp|ml/i.test(`${line.form} ${line.strength}`);
    const sameForm = single.filter((m) => liquid(m) === wantsLiquid);
    // Same strength as written: use that product.
    const exact = want ? sameForm.find((m) => num(m.strength) === want) : undefined;
    if (exact) return exact;
    // No strength written: the usual product of that form.
    if (!want && sameForm.length) return sameForm[0];
    // Otherwise the medicine exactly as written, never a different strength.
    const [m] = medicinesFromFacts({
      is_medicine_pack: true,
      brand_name: '',
      active_ingredients: [{ name: line.name, strength: line.strength }],
      dosage_form: line.form,
      manufacturer: '',
      text_seen: '',
      confidence: 'medium',
    });
    return m ? { ...m, id: m.id.replace(/^photo-/, 'rx-'), source: 'photo' } : null;
  }

  const hits = searchMedicines(line.name, 6).filter((h) => h.score >= CONFIDENT && h.medicine.brand.toLowerCase().includes(line.name.trim().toLowerCase().split(/\s+/)[0]));
  if (hits.length) return byStrength(hits.map((h) => h.medicine));
  return null;
}

/**
 * For a line the AI was NOT sure about: only an EXACT medicine or brand name counts
 * (no fuzzy matching, which could turn a misread into a real but wrong medicine).
 * The app shows it unticked, for the user to compare with the paper.
 */
export function matchUnsureLine(line: RxLine): Medicine | null {
  const name = line.name.trim();
  if (name.length < 4) return null;
  if (findIngredientId(name)) return matchRxLine({ ...line, legible: 'clear' });
  const brand = MEDICINES.find((m) => m.brand.toLowerCase() === name.toLowerCase());
  return brand ?? null;
}
