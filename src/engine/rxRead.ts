import { findIngredientId } from '../data/medicines';
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
 * 1. Our own list (brand or generic name), preferring the same strength.
 * 2. A known ingredient name: the medicine as written on the prescription.
 * 3. Otherwise the caller may search the wider database (RxNorm).
 */
export function matchRxLine(line: RxLine): Medicine | null {
  if (line.legible !== 'clear' || line.name.trim().length < 3) return null;
  const hits = searchMedicines(line.name, 6).filter((h) => h.score >= CONFIDENT);
  if (hits.length) {
    const want = num(line.strength);
    const sameStrength = want ? hits.find((h) => num(h.medicine.strength) === want) : undefined;
    return (sameStrength ?? hits[0]).medicine;
  }
  if (findIngredientId(line.name)) {
    const [m] = medicinesFromFacts({
      is_medicine_pack: true,
      brand_name: '',
      active_ingredients: [{ name: line.name, strength: line.strength }],
      dosage_form: line.form,
      manufacturer: '',
      text_seen: '',
      confidence: 'medium',
    });
    return m ?? null;
  }
  return null;
}
