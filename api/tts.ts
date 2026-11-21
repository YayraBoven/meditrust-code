/**
 * Vercel serverless function: POST /api/tts  { text, language }
 * Turns text into speech with GhanaNLP's Khaya API. The API key stays here, on
 * the server (Vercel environment variable KHAYA_API_KEY), never in the app.
 */
export const config = { runtime: 'edge' };

const LANGS = new Set(['twi', 'ewe', 'gaa', 'dag', 'fat', 'eng']);
const KHAYA_TTS = 'https://translation-api.ghananlp.org/tts/v1/tts';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const key = process.env.KHAYA_API_KEY;
  if (!key) return new Response('Text-to-speech is not configured (KHAYA_API_KEY missing).', { status: 503 });

  let body: { text?: unknown; language?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const language = typeof body.language === 'string' ? body.language : '';
  if (!text || text.length > 800) return new Response('Text must be 1–800 characters.', { status: 400 });
  if (!LANGS.has(language)) return new Response('Unsupported language.', { status: 400 });

  const upstream = await fetch(KHAYA_TTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': key },
    body: JSON.stringify({ text, language, speaker_id: 'female' }),
  });
  if (!upstream.ok) return new Response(`Speech service error (${upstream.status}).`, { status: 502 });

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'audio/wav',
      // Same text gives the same audio: let the browser and Vercel's edge cache reuse it.
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
