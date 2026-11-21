import type { Medicine } from '../data/types';
import { INGREDIENTS, ingredientName } from '../data/medicines';
import { searchMedicines } from './match';

/**
 * Reads the text on a photo of a medicine pack, on the phone itself
 * (Tesseract.js, served by the app). The photo is never uploaded.
 * The text is then matched against the medicine list; the user still confirms.
 */

type TesseractWorker = { recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string; confidence: number } }>; terminate: () => Promise<unknown> };

let workerPromise: Promise<TesseractWorker> | null = null;
let progressCb: ((p: number) => void) | null = null;

async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM } = await import('tesseract.js');
      const base = new URL('tesseract/', document.baseURI).href;
      const w = await createWorker('eng', OEM.LSTM_ONLY, {
        workerPath: `${base}worker.min.js`,
        corePath: `${base}core`,
        langPath: `${base}lang`,
        gzip: true,
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') progressCb?.(0.35 + m.progress * 0.65);
          else if (m.status.startsWith('loading')) progressCb?.(Math.min(0.3, m.progress * 0.3));
        },
      });
      return w as unknown as TesseractWorker;
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

/** Downscale and boost contrast: faster and easier to read for the engine. */
async function prepare(source: Blob | HTMLCanvasElement): Promise<HTMLCanvasElement> {
  let w: number;
  let h: number;
  let draw: (ctx: CanvasRenderingContext2D, cw: number, ch: number) => void;
  if (source instanceof HTMLCanvasElement) {
    w = source.width;
    h = source.height;
    draw = (ctx, cw, ch) => ctx.drawImage(source, 0, 0, cw, ch);
  } else {
    const bmp = await createImageBitmap(source);
    w = bmp.width;
    h = bmp.height;
    draw = (ctx, cw, ch) => ctx.drawImage(bmp, 0, 0, cw, ch);
  }
  const scale = Math.min(1, 1600 / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  draw(ctx, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - min) / range) * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export async function readPackText(source: Blob | HTMLCanvasElement, onProgress?: (p: number) => void): Promise<{ text: string; confidence: number }> {
  progressCb = onProgress ?? null;
  onProgress?.(0.02);
  const [worker, canvas] = await Promise.all([getWorker(), prepare(source)]);
  const { data } = await worker.recognize(canvas);
  onProgress?.(1);
  return { text: data.text, confidence: data.confidence };
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
