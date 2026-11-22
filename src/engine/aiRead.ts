import { MEDICINES, findIngredientId } from '../data/medicines';
import type { Medicine } from '../data/types';
import { scoreText } from './match';
import type { Crop } from './ocr';

/**
 * AI pack reading: the photo is sent (through our own server function) to Alibaba
 * Qwen or Gemini, which reports only what is printed on the pack. MediTrust then matches
 * that to its medicine list. The user still confirms, and the safety rules, not
 * the AI, decide any risk.
 */

export interface PackFacts {
  is_medicine_pack: boolean;
  brand_name: string;
  active_ingredients: { name: string; strength: string }[];
  dosage_form: string;
  manufacturer: string;
  text_seen: string;
  confidence: 'high' | 'medium' | 'low';
  model?: string;
}

/** Downscale (and crop) to a JPEG data URL: small enough to send quickly, sharp enough to read. */
export async function toJpeg(source: Blob | HTMLCanvasElement, crop?: Crop): Promise<string> {
  let img: CanvasImageSource;
  let w: number;
  let h: number;
  if (source instanceof HTMLCanvasElement) {
    img = source;
    w = source.width;
    h = source.height;
  } else {
    const bmp = await createImageBitmap(source, { imageOrientation: 'from-image' });
    img = bmp;
    w = bmp.width;
    h = bmp.height;
  }
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const sw = c.w * w;
  const sh = c.h * h;
  const scale = Math.min(1, 1280 / Math.max(sw, sh));
  const out = document.createElement('canvas');
  out.width = Math.round(sw * scale);
  out.height = Math.round(sh * scale);
  out.getContext('2d')!.drawImage(img, c.x * w, c.y * h, sw, sh, 0, 0, out.width, out.height);
  return out.toDataURL('image/jpeg', 0.85);
}

export async function aiReadPack(source: Blob | HTMLCanvasElement, crop?: Crop, timeoutMs = 35000): Promise<PackFacts> {
  const image = await toJpeg(source, crop);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(new URL('api/identify', document.baseURI), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`identify ${res.status}`);
    return (await res.json()) as PackFacts;
  } finally {
    clearTimeout(timer);
  }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const title = (s: string) => s.replace(/\b([a-z])/g, (c) => c.toUpperCase());
const firstNumber = (s: string) => s.match(/\d+(\.\d+)?/)?.[0];

/**
 * Turn what was printed on the pack into medicines to choose from:
 * our own entry if the brand matches, the product exactly as printed, and our
 * generic entries with the same ingredients. Exported for tests.
 */
export function medicinesFromFacts(f: PackFacts): Medicine[] {
  if (!f.is_medicine_pack || (!f.brand_name && !f.active_ingredients.length)) return [];
  const labels: Record<string, string> = {};
  const ids = f.active_ingredients.map((a) => {
    const known = findIngredientId(a.name);
    if (known) return known;
    const id = `rxing-${slug(a.name)}`;
    labels[id] = title(a.name.toLowerCase());
    return id;
  });
  const key = [...new Set(ids)].sort().join('|');
  const strengths = f.active_ingredients.map((a) => a.strength).filter(Boolean);
  const firstStrength = firstNumber(strengths[0] ?? '');

  // 1. Our own entry with the same brand name (e.g. a demo pack).
  const brandMatches = f.brand_name ? MEDICINES.filter((m) => scoreText(f.brand_name, m.brand) >= 0.9 && (!ids.length || [...m.ingredients].sort().join('|') === key)) : [];

  // 2. The product exactly as printed on the pack.
  const printed: Medicine | null = ids.length
    ? {
        id: `photo-${slug(f.brand_name || f.active_ingredients.map((a) => a.name).join('-'))}-${slug(strengths.join('-'))}`,
        brand: f.brand_name || f.active_ingredients.map((a) => title(a.name.toLowerCase())).join(' + '),
        generic: f.active_ingredients.map((a) => `${title(a.name.toLowerCase())}${a.strength ? ` ${a.strength}` : ''}`).join(' + '),
        strength: strengths.join(' / '),
        form: f.dosage_form ? title(f.dosage_form) : '',
        ingredients: [...new Set(ids)],
        prescriptionOnly: null,
        source: 'photo',
        ingredientLabels: labels,
      }
    : null;

  // 3. Our generic entries with exactly the same ingredients, closest strength first.
  const sameIngredients = MEDICINES.filter((m) => !brandMatches.includes(m) && [...m.ingredients].sort().join('|') === key).sort(
    (a, b) => Number(firstNumber(b.strength) === firstStrength) - Number(firstNumber(a.strength) === firstStrength),
  );

  const list = [...brandMatches, ...(brandMatches.length ? [] : printed ? [printed] : []), ...sameIngredients];
  return list.slice(0, 4);
}

/** Short chips describing what the AI read, e.g. "Panadol Extra", "Paracetamol 500 mg". */
export function factChips(f: PackFacts): string[] {
  return [f.brand_name, ...f.active_ingredients.map((a) => `${title(a.name.toLowerCase())}${a.strength ? ` ${a.strength}` : ''}`)].filter(Boolean).slice(0, 5);
}
