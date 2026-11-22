/**
 * Vercel serverless function: POST /api/identify  { image: "data:image/jpeg;base64,..." }
 *
 * Asks an AI vision model (Alibaba Qwen first, Google Gemini as backup) to READ a
 * photo of a medicine pack and report only what is printed on it (brand, active
 * ingredients, strengths, form). It does not decide anything about safety:
 * MediTrust's own rules do that after the user confirms.
 * Keys stay on the server (Vercel environment variables QWEN_API_KEY, GEMINI_API_KEY).
 * Only the photo is sent, never the user's profile or name.
 */
export const config = { runtime: 'edge' };

import { accountBlocked, chat, parseJson, providers, type Attempt, type Provider } from './_providers';

const SYSTEM = `You read photos of medicine packaging for a medicine-safety app in Ghana.
Report ONLY what is printed and legible on the pack: brand name, active ingredients with strengths,
dosage form and manufacturer. Never add ingredients, uses or advice that are not printed.
If the photo is not a medicine pack, or nothing is legible, set is_medicine_pack to false.
Use empty strings for anything you cannot read. Be honest about confidence.`;

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

/** Reads a pack photo with each configured provider in turn (Qwen first, then Gemini). */
export async function identifyPack(image: string, list: Provider[], fetchImpl: typeof fetch = fetch): Promise<Response> {
  const attempts: Attempt[] = [];
  for (const p of list) {
    for (const model of p.vision) {
      const body: Record<string, unknown> = {
        temperature: 0,
        messages: [
          { role: 'system', content: p.jsonSchema ? SYSTEM : `${SYSTEM}\nReply with ONLY a JSON object matching this JSON Schema, no other text:\n${JSON.stringify(SCHEMA)}` },
          { role: 'user', content: [{ type: 'text', text: 'Read this medicine pack.' }, { type: 'image_url', image_url: { url: image } }] },
        ],
        response_format: p.jsonSchema ? { type: 'json_schema', json_schema: { name: 'pack', schema: SCHEMA } } : { type: 'json_object' },
      };
      const content = await chat(p, model, body, fetchImpl, attempts);
      const parsed = content ? parseJson(content) : null;
      if (parsed && typeof parsed.is_medicine_pack === 'boolean' && Array.isArray(parsed.active_ingredients)) {
        return Response.json({ ...parsed, provider: p.name, model, tried: attempts });
      }
      if (accountBlocked(attempts)) break; // not activated or bad key: go straight to the next provider
    }
  }
  console.log('identify: all providers failed', JSON.stringify(attempts));
  return Response.json({ error: 'The AI reader is busy. Please try again.', tried: attempts }, { status: 503 });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const list = providers();
  if (!list.length) return new Response('AI reading is not configured (no QWEN_API_KEY or GEMINI_API_KEY).', { status: 503 });
  let body: { image?: unknown };
  try {
    body = (await req.json()) as { image?: unknown };
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const image = typeof body.image === 'string' ? body.image : '';
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > 6_000_000) {
    return new Response('Send a JPEG, PNG or WebP image under about 4 MB.', { status: 400 });
  }
  return identifyPack(image, list);
}
