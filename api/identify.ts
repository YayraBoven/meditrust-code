/**
 * Vercel serverless function: POST /api/identify  { image: "data:image/jpeg;base64,..." }
 *
 * Asks Google Gemini to READ a photo of a medicine pack and report only what is
 * printed on it (brand, active ingredients, strengths, form). It does not decide
 * anything about safety: MediTrust's own rules do that after the user confirms.
 * The API key stays on the server (Vercel environment variable GEMINI_API_KEY).
 * Only the photo is sent, never the user's profile or name.
 */
export const config = { runtime: 'edge' };

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
// Tried in order: free-tier models change and can be busy, so fall back automatically.
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];

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

export async function identifyWithGemini(image: string, key: string, fetchImpl: typeof fetch = fetch): Promise<Response> {
  for (const model of MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: [{ type: 'text', text: 'Read this medicine pack.' }, { type: 'image_url', image_url: { url: image } }] },
          ],
          response_format: { type: 'json_schema', json_schema: { name: 'pack', schema: SCHEMA } },
          temperature: 0,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) continue; // busy, retired or over quota: try the next model
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data?.choices?.[0]?.message?.content;
      if (!content) continue;
      const parsed = JSON.parse(content);
      return Response.json({ ...parsed, model });
    } catch {
      // timeout or bad JSON: try the next model
    } finally {
      clearTimeout(timer);
    }
  }
  return new Response('The AI reader is busy. Please try again.', { status: 503 });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return new Response('AI reading is not configured (GEMINI_API_KEY missing).', { status: 503 });
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
  return identifyWithGemini(image, key);
}
