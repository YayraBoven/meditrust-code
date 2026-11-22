/**
 * Vercel serverless function: POST /api/identify  { image: "data:image/jpeg;base64,...", mode?: "prescription" }
 *
 * Asks an AI vision model (Alibaba Qwen first, Google Gemini as backup) to READ a
 * photo of a medicine pack and report only what is printed on it (brand, active
 * ingredients, strengths, form). It does not decide anything about safety:
 * MediTrust's own rules do that after the user confirms.
 * Keys stay on the server (Vercel environment variables QWEN_API_KEY, GEMINI_API_KEY).
 * Only the photo is sent, never the user's profile or name. In prescription mode the AI
 * returns only the medicine lines, never the patient's or doctor's details.
 */
export const config = { runtime: 'edge' };

import { accountBlocked, chat, makeBudget, parseJson, providers, type Attempt, type Provider } from './_providers';

const SYSTEM = `You read photos of medicine packaging for a medicine-safety app in Ghana.
Report ONLY what is printed and legible on the pack: brand name, active ingredients with strengths,
dosage form and manufacturer. Never add ingredients, uses or advice that are not printed.
If the photo is not a medicine pack, or nothing is legible, set is_medicine_pack to false.
Use empty strings for anything you cannot read. Be honest about confidence.
NEVER guess or complete a number, strength or word that is hidden, covered, cut off or blurred:
if any digit of a strength is not clearly legible, leave that strength as an empty string.
A wrong strength is far worse than a missing one.`;

const SCHEMA = {
  type: 'object',
  properties: {
    is_medicine_pack: { type: 'boolean' },
    brand_name: { type: 'string' },
    active_ingredients: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, strength: { type: 'string' } }, required: ['name', 'strength'] },
    },
    dosage_form: { type: 'string' },
    manufacturer: { type: 'string' },
    text_seen: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['is_medicine_pack', 'brand_name', 'active_ingredients', 'dosage_form', 'manufacturer', 'text_seen', 'confidence'],
};

interface ReadTask {
  system: string;
  schema: Record<string, unknown>;
  schemaName: string;
  ask: string;
  valid: (o: Record<string, unknown>) => boolean;
}

const PACK_TASK: ReadTask = {
  system: SYSTEM,
  schema: SCHEMA,
  schemaName: 'pack',
  ask: 'Read this medicine pack.',
  valid: (o) => typeof o.is_medicine_pack === 'boolean' && Array.isArray(o.active_ingredients),
};

const RX_SYSTEM = `You read photos of doctors' prescriptions for a medicine-safety app in Ghana.
Report ONLY the medicine lines: for each medicine, the name exactly as written, the strength,
the form (tablet, syrup, injection...) and the directions (e.g. "1 tab twice daily for 5 days").
PRIVACY: never return the patient's name, age, address, phone, hospital number, the doctor's name,
signature, registration number or the clinic's details. Leave them out completely.
Handwriting can be hard to read. For each medicine set "legible" to "clear" only if you can read the
whole name with confidence; otherwise "unclear". NEVER guess or complete a medicine name, number or
strength you cannot read: use an empty string, or mark the line "unclear". A wrong medicine name is
dangerous; a missing one is safe because a pharmacist will check.
If the photo is not a prescription, set is_prescription to false and return no medicines.`;

const RX_SCHEMA = {
  type: 'object',
  properties: {
    is_prescription: { type: 'boolean' },
    medicines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          strength: { type: 'string' },
          form: { type: 'string' },
          directions: { type: 'string' },
          legible: { type: 'string', enum: ['clear', 'unclear'] },
        },
        required: ['name', 'strength', 'form', 'directions', 'legible'],
      },
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['is_prescription', 'medicines', 'confidence'],
};

const RX_TASK: ReadTask = {
  system: RX_SYSTEM,
  schema: RX_SCHEMA,
  schemaName: 'prescription',
  ask: 'Read the medicines on this prescription.',
  valid: (o) => typeof o.is_prescription === 'boolean' && Array.isArray(o.medicines),
};

/** Reads a photo with each configured provider in turn (Qwen first, then Gemini). */
export async function readImage(image: string, list: Provider[], task: ReadTask, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const attempts: Attempt[] = [];
  const budget = makeBudget();
  for (const [i, p] of list.entries()) {
    for (const model of p.vision) {
      const wait = budget(p, list.slice(i + 1));
      if (!wait) break; // out of time for this provider: move on
      const body: Record<string, unknown> = {
        temperature: 0,
        messages: [
          { role: 'system', content: p.jsonSchema ? task.system : `${task.system}\nReply with ONLY a JSON object matching this JSON Schema, no other text:\n${JSON.stringify(task.schema)}` },
          { role: 'user', content: [{ type: 'text', text: task.ask }, { type: 'image_url', image_url: { url: image } }] },
        ],
        response_format: p.jsonSchema ? { type: 'json_schema', json_schema: { name: task.schemaName, schema: task.schema } } : { type: 'json_object' },
      };
      const content = await chat(p, model, body, fetchImpl, attempts, wait);
      const parsed = content ? parseJson(content) : null;
      if (parsed && task.valid(parsed)) return Response.json({ ...parsed, provider: p.name, model, tried: attempts });
      if (accountBlocked(attempts)) break; // bad key: go straight to the next provider
    }
  }
  console.log('identify: all providers failed', JSON.stringify(attempts));
  return Response.json({ error: 'The AI reader is busy. Please try again.', tried: attempts }, { status: 503 });
}

/** Reads a medicine pack photo. */
export const identifyPack = (image: string, list: Provider[], fetchImpl: typeof fetch = fetch) => readImage(image, list, PACK_TASK, fetchImpl);

/** Reads the medicine lines of a prescription photo (no personal details). */
export const readPrescription = (image: string, list: Provider[], fetchImpl: typeof fetch = fetch) => readImage(image, list, RX_TASK, fetchImpl);

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const list = providers();
  if (!list.length) return new Response('AI reading is not configured (no QWEN_API_KEY or GEMINI_API_KEY).', { status: 503 });
  let body: { image?: unknown; mode?: unknown };
  try {
    body = (await req.json()) as { image?: unknown; mode?: unknown };
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const image = typeof body.image === 'string' ? body.image : '';
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > 6_000_000) {
    return new Response('Send a JPEG, PNG or WebP image under about 4 MB.', { status: 400 });
  }
  return body.mode === 'prescription' ? readPrescription(image, list) : identifyPack(image, list);
}
