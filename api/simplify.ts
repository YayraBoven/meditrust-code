/**
 * Vercel serverless function: POST /api/simplify  { text: "<trusted MedlinePlus text>" }
 *
 * Asks Google Gemini to rewrite TRUSTED text in short, plain sentences. It must
 * not add facts that are not in the text. The app labels the result as an AI
 * summary and runs its safety filter on it before showing it.
 */
export const config = { runtime: 'edge' };

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];

const SYSTEM = `You rewrite trusted medicine information for people in Ghana with limited health knowledge.
Rules:
- Use ONLY facts that appear in the text you are given. Never add uses, doses, side effects or advice.
- Write 2 to 4 short sentences in plain English (about a 10-year-old's reading level).
- Do not say a medicine is "safe". Do not tell anyone to start or stop a medicine.
- End with: "Ask a pharmacist or doctor if you have questions."`;

export async function simplifyWithGemini(text: string, key: string, fetchImpl: typeof fetch = fetch): Promise<Response> {
  for (const model of MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: `Trusted text from MedlinePlus:\n"""${text}"""` },
          ],
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const out = data?.choices?.[0]?.message?.content?.trim();
      if (out) return Response.json({ text: out, model });
    } catch {
      // try the next model
    } finally {
      clearTimeout(timer);
    }
  }
  return new Response('The AI is busy. Please try again.', { status: 503 });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return new Response('AI is not configured (GEMINI_API_KEY missing).', { status: 503 });
  let body: { text?: unknown };
  try {
    body = (await req.json()) as { text?: unknown };
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 4000) return new Response('Text must be 1–4000 characters.', { status: 400 });
  return simplifyWithGemini(text, key);
}
