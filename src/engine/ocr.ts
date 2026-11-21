import type { Medicine } from '../data/types';
import { INGREDIENTS, ingredientName } from '../data/medicines';
import { searchMedicines } from './match';

/**
 * Reads the text on a photo of a medicine pack, on the phone itself
 * (Tesseract.js, served by the app). The photo is never uploaded.
 * The text is then matched against the medicine list; the user still confirms.
 */

interface OcrWord {
  text: string;
  confidence: number;
}
interface OcrData {
  text: string;
  confidence: number;
  words?: OcrWord[];
}
type TesseractWorker = {
  recognize: (img: HTMLCanvasElement) => Promise<{ data: OcrData }>;
  setParameters: (p: Record<string, string>) => Promise<unknown>;
};

let workerPromise: Promise<TesseractWorker> | null = null;
let progressCb: ((p: number) => void) | null = null;

async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM, PSM } = await import('tesseract.js');
      const base = new URL('tesseract/', document.baseURI).href;
      const w = (await createWorker('eng', OEM.LSTM_ONLY, {
        workerPath: `${base}worker.min.js`,
        corePath: `${base}core`,
        langPath: `${base}lang`,
        gzip: true,
        logger: (m: { status: string; progress: number }) => {
          if (m.status.startsWith('loading')) progressCb?.(Math.min(0.2, m.progress * 0.2));
        },
      })) as unknown as TesseractWorker;
      // Measured on pack photos: "single block" reads the most useful text.
      await w.setParameters({ tessedit_pageseg_mode: String(PSM.SINGLE_BLOCK) });
      return w;
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

/** Region of the image to read, as fractions of width/height (e.g. the camera guide box). */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Load the photo upright (phones store rotation separately), crop and resize. */
async function loadUpright(source: Blob | HTMLCanvasElement, crop?: Crop): Promise<HTMLCanvasElement> {
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
  const sx = Math.round(c.x * w);
  const sy = Math.round(c.y * h);
  const sw = Math.round(c.w * w);
  const sh = Math.round(c.h * h);
  // Measured: about 1600 px is the sweet spot; enlarging further is slower and not better.
  const scale = Math.min(1, 1600 / Math.max(sw, sh));
  const out = document.createElement('canvas');
  out.width = Math.round(sw * scale);
  out.height = Math.round(sh * scale);
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out;
}

type Variant = 'contrast' | 'binary' | 'inverted';

/** Grey + contrast stretch, or black-and-white (Otsu threshold), optionally inverted for light text on dark boxes. */
function makeVariant(src: HTMLCanvasElement, variant: Variant, rotate = 0): HTMLCanvasElement {
  const out = document.createElement('canvas');
  const swap = rotate % 180 !== 0;
  out.width = swap ? src.height : src.width;
  out.height = swap ? src.width : src.height;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  const hist = new Array<number>(256).fill(0);
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = g;
    hist[g]++;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  let threshold = 128;
  if (variant !== 'contrast') {
    // Otsu: the grey level that best separates text from background.
    const total = d.length / 4;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0;
    let wB = 0;
    let best = 0;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) ** 2;
      if (between > best) {
        best = between;
        threshold = t;
      }
    }
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    let v = variant === 'contrast' ? ((d[i] - min) / range) * 255 : d[i] > threshold ? 255 : 0;
    if (variant === 'inverted') v = 255 - v;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

export interface PackReading {
  /** Everything the reader produced (noisy, but the matcher is forgiving). */
  text: string;
  confidence: number;
  /** Number of confident words: low means the photo could not be read well. */
  words: number;
}

/** Short, human-readable list of what was recognised: medicine words and strengths. */
export function spottedTerms(text: string): string[] {
  const words = candidateWords(text).filter((w) => (searchMedicines(w, 1)[0]?.score ?? 0) >= 0.7);
  const strengths = [...new Set((text.match(/\b\d{1,4}\s?(mg|mcg|g|iu|ml)\b/gi) ?? []).map((x) => x.replace(/\s+/g, ' ').toLowerCase()))];
  const pretty = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  return [...words.slice(0, 4).map(pretty), ...strengths.slice(0, 2)];
}

/** Keep confident, plausible words and rebuild the lines. */
function cleanReading(data: OcrData): PackReading {
  const confident = (data.words ?? []).filter((w) => w.confidence >= 50 && /[A-Za-z]{3,}/.test(w.text));
  return { text: data.text, confidence: data.confidence, words: data.words ? confident.length : data.text.split(/\s+/).length };
}

/** How promising a reading is: a recognised medicine beats everything, then confident words. */
function rank(r: PackReading): number {
  const best = findMedicinesInText(r.text, 1)[0]?.score ?? 0;
  return best * 100 + Math.min(r.words, 30) * 1.5 + r.confidence * 0.2;
}

/**
 * Read a pack photo. Tries several cleaned-up versions (and, if needed, other
 * rotations) and keeps the most useful reading. Runs entirely on the phone.
 */
export async function readPackText(source: Blob | HTMLCanvasElement, onProgress?: (p: number) => void, crop?: Crop): Promise<PackReading> {
  progressCb = onProgress ?? null;
  onProgress?.(0.02);
  const [worker, base] = await Promise.all([getWorker(), loadUpright(source, crop)]);
  const plan: [Variant, number][] = [
    ['contrast', 0],
    ['binary', 0],
    ['inverted', 0],
  ];
  // Uploaded photos can still be sideways (e.g. screenshots of a rotated photo).
  const fallback: [Variant, number][] = source instanceof HTMLCanvasElement ? [] : [
    ['contrast', 90],
    ['contrast', 270],
  ];
  let best: PackReading | null = null;
  let bestRank = -1;
  const run = async (steps: [Variant, number][], from: number, to: number) => {
    for (let i = 0; i < steps.length; i++) {
      const [variant, rot] = steps[i];
      const { data } = await worker.recognize(makeVariant(base, variant, rot));
      const reading = cleanReading(data);
      const score = rank(reading);
      if (score > bestRank) {
        best = reading;
        bestRank = score;
      }
      onProgress?.(from + ((i + 1) / steps.length) * (to - from));
      if (bestRank >= 100) return; // a medicine was recognised: good enough
    }
  };
  await run(plan, 0.2, 0.85);
  // Nothing recognised: the photo may be sideways.
  if (bestRank < 100 && fallback.length) await run(fallback, 0.85, 0.98);
  onProgress?.(1);
  return best ?? { text: '', confidence: 0, words: 0 };
}

/** Warm the engine up in the background so the first scan feels quick. */
export const preloadOcr = () => void getWorker().catch(() => undefined);

const STOP = new Set(
  'tablet tablets capsule capsules caplet caplets film coated each contains contain keep reach children store below above batch expiry exp mfg date manufactured manufacturer ghana limited ltd pharma pharmaceutical pharmaceuticals industries oral use only dosage directions adults adult warning read leaflet before using strength pack box blister sugar free syrup suspension dispersible registered number reg protect light moisture place cool dry prescription medicine medicines only pharmacy sale sold supply dietary supplement supplements film-coated coated food nutrition natural made with'.split(
    ' ',
  ),
);

/** Words worth searching for, longest first. Exported for tests and the RxNorm fallback. */
export function candidateWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s+-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && /[a-z]{4,}/.test(w) && !STOP.has(w));
  return [...new Set(words)].sort((a, b) => b.length - a.length);
}

export interface TextMatch {
  medicine: Medicine;
  score: number;
}

const lc = (s: string) => s.toLowerCase();

/** Share of a medicine's ingredients that are printed on the pack (by name or synonym). */
function ingredientCoverage(m: Medicine, text: string): number {
  const t = lc(text);
  const hits = m.ingredients.filter((id) => {
    const names = [ingredientName(m, id), ...(INGREDIENTS[id]?.synonyms ?? [])].map(lc);
    return names.some((n) => t.includes(n.split(' ')[0]));
  });
  return m.ingredients.length ? hits.length / m.ingredients.length : 0;
}

/** Find medicines named in the text read from a pack. */
export function findMedicinesInText(text: string, limit = 4): TextMatch[] {
  const words = candidateWords(text);
  const rawWords = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const phrases = new Set<string>(words);
  for (let i = 0; i < rawWords.length - 1; i++) {
    if (rawWords[i].length >= 3 && rawWords[i + 1].length >= 3) phrases.add(`${rawWords[i]} ${rawWords[i + 1]}`);
  }
  const best = new Map<string, TextMatch>();
  for (const p of phrases) {
    for (const r of searchMedicines(p, 6)) {
      if (r.score < 0.7) continue;
      const cur = best.get(r.medicine.id);
      if (!cur || r.score > cur.score) best.set(r.medicine.id, { medicine: r.medicine, score: r.score });
    }
  }
  const ranked = [...best.values()].map(({ medicine, score }) => {
    // Prefer products whose every ingredient is printed on the pack, and whose strength matches.
    const coverage = ingredientCoverage(medicine, text);
    const num = medicine.strength.match(/\d+/)?.[0];
    const strength = num && new RegExp(`\\b${num}\\s?(mg|mcg|g|iu|ml)?\\b`, 'i').test(text) ? 0.05 : 0;
    // More printed ingredients matched = more specific product (paracetamol + caffeine beats paracetamol alone).
    const specificity = 0.04 * Math.round(coverage * medicine.ingredients.length);
    return { medicine, score: score + 0.25 * coverage - (coverage < 1 ? 0.15 : 0) + strength + specificity };
  });
  return ranked.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Phrases from the top of the pack that do not match MediTrust's own list:
 * usually a brand name ("Panadol Extra") worth looking up in RxNorm.
 */
export function unknownBrandPhrases(text: string, max = 2): string[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/[^A-Za-z0-9\s+-]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((l) => /[a-z]{4,}/i.test(l))
    .slice(0, 4);
  const out: string[] = [];
  for (const line of lines) {
    const words = line.split(' ').filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase()) && !/^\d/.test(w));
    if (!words.length) continue;
    // Brand names sit above the generic name: stop at the first line we already recognise.
    if (words[0].length >= 4 && (searchMedicines(words[0], 1)[0]?.score ?? 0) >= 0.7) break;
    out.push(words.slice(0, 2).join(' '));
    if (out.length >= max) break;
  }
  return out;
}
