import { MEDICINES, findIngredientId } from '../data/medicines';
import type { Medicine } from '../data/types';
import { medicinesFromFacts, toJpeg } from './aiRead';

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
  /** How well the medicine NAME could be read. */
  name_legibility?: 'clear' | 'probably' | 'unreadable';
  /** How well the DOSE (strength) could be read. */
  dose_legibility?: 'clear' | 'unsure' | 'none';
  /** Older single rating, still accepted. */
  legible?: 'clear' | 'unclear';
}

/** The name rating, also accepting the older single rating. */
export const nameLevel = (l: RxLine) => l.name_legibility ?? (l.legible === 'clear' ? 'clear' : 'unreadable');
/** True when a dose was written but could not be read reliably. */
export const doseUnsure = (l: RxLine) => (l.dose_legibility ? l.dose_legibility === 'unsure' : l.legible === 'unclear' && !!l.strength);

/** Shown instead of a strength we could not read reliably (also on the pharmacist summary). */
export const DOSE_UNCLEAR = 'Dose not read reliably: confirm with pharmacist';

export type RxStatus = 'ok' | 'unsure' | 'unreadable' | 'not-found';

export interface RxResult {
  medicine: Medicine | null;
  status: RxStatus;
  doseUnsure: boolean;
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
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s: string) => norm(s).replace(/ /g, '-');

/** The medicine exactly as written (one ingredient), when we have no matching product. */
function asWritten(line: RxLine, strength: string): Medicine | null {
  const [m] = medicinesFromFacts({
    is_medicine_pack: true,
    brand_name: '',
    active_ingredients: [{ name: line.name, strength }],
    dosage_form: line.form,
    manufacturer: '',
    text_seen: '',
    confidence: 'medium',
  });
  return m ? { ...m, id: `rx-${slug(line.name)}-${slug(strength) || 'any'}`, source: 'photo' } : null;
}

/**
 * EXACT match of a written name to a real medicine in our own list, or null.
 * Never fuzzy: a misread must not turn into a real but different medicine.
 * - A medicine (ingredient) name: a plain product with ONLY that ingredient, same
 *   strength and form; otherwise the medicine as written. Never a combination
 *   product, never a different strength.
 * - A brand name: our product with exactly that brand name.
 * `strength` is ignored when the dose could not be read reliably.
 */
export function exactMatch(line: RxLine, useStrength = true): Medicine | null {
  const name = line.name.trim();
  if (name.length < 3) return null;
  const strength = useStrength ? line.strength : '';
  const want = num(strength);

  const ingredient = findIngredientId(name);
  if (ingredient) {
    const single = MEDICINES.filter((m) => m.ingredients.length === 1 && m.ingredients[0] === ingredient);
    const liquid = (m: Medicine) => /syrup|susp|ml/i.test(`${m.form} ${m.strength}`);
    const wantsLiquid = /syrup|susp|ml/i.test(`${line.form} ${strength}`);
    const sameForm = single.filter((m) => liquid(m) === wantsLiquid);
    // Dose unreadable: the medicine itself with no strength, never a product whose name carries a dose.
    if (!useStrength) return asWritten(line, '');
    const exact = want ? sameForm.find((m) => num(m.strength) === want) : undefined;
    if (exact) return exact;
    if (!want && sameForm.length) return sameForm[0];
    return asWritten(line, strength);
  }

  const brands = MEDICINES.filter((m) => norm(m.brand) === norm(name) || norm(m.brand).replace(/ \d+$/, '') === norm(name));
  if (brands.length) return (want ? brands.find((m) => num(m.strength) === want) : undefined) ?? brands[0];
  return null;
}

/** True when a wider-database result is exactly the written name (brand or ingredient). */
export function isExactRemote(m: Medicine, writtenName: string): boolean {
  const w = norm(writtenName);
  return norm(m.brand) === w || norm(m.generic) === w || m.ingredients.some((i) => norm(i.replace(/^rxing-/, '')) === w);
}

/**
 * Decides how one prescription line is shown:
 * - ok: name read clearly or probably AND it is a real medicine -> ticked
 * - unsure: real medicine, but the AI could barely read the name -> unticked, compare with the paper
 * - unreadable / not-found: no exact real medicine -> ask the pharmacist
 * An unsure dose never blocks the check (the rules use ingredients, not doses);
 * it is flagged on the screen and on the pharmacist summary instead.
 */
export function classifyLine(line: RxLine, medicine: Medicine | null): RxResult {
  const unsureDose = doseUnsure(line);
  const level = nameLevel(line);
  if (!medicine) return { medicine: null, status: level === 'unreadable' ? 'unreadable' : 'not-found', doseUnsure: unsureDose };
  const shown = unsureDose
    ? {
        ...medicine,
        id: `${medicine.id}--dose-unclear`,
        // Drop a dose that is part of a brand name too (e.g. "Ibucare 400" -> "Ibucare").
        brand: medicine.brand.replace(/\s+\d[\d.,/]*\s*(mg|mcg|g|ml|%)?$/i, ''),
        strength: DOSE_UNCLEAR,
        source: 'photo' as const,
      }
    : medicine;
  return { medicine: shown, status: level === 'unreadable' ? 'unsure' : 'ok', doseUnsure: unsureDose };
}

/** Our own-list part of the decision (the caller may add an exact RxNorm result). */
export function matchLine(line: RxLine): RxResult {
  return classifyLine(line, exactMatch(line, !doseUnsure(line)));
}
