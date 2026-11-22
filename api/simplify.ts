/**
 * Vercel serverless function: POST /api/simplify  { text: "<trusted MedlinePlus text>" }
 *
 * Asks an AI model (Alibaba Qwen first, Google Gemini as backup) to rewrite TRUSTED text in short, plain sentences. It must
 * not add facts that are not in the text. The app labels the result as an AI
 * summary and runs its safety filter on it before showing it.
 */
export const config = { runtime: 'edge' };

import { accountBlocked, chat, makeBudget, providers, type Attempt, type Provider } from './_providers';

const SYSTEM = `You rewrite trusted medicine information for people in Ghana with limited health knowledge.
Rules:
- Use ONLY facts that appear in the text you are given. Never add uses, doses, side effects or advice.
- Write 2 to 4 short sentences in plain English (about a 10-year-old's reading level).
- Do not say a medicine is "safe". Do not tell anyone to start or stop a medicine.
- End with: "Ask a pharmacist or doctor if you have questions."`;

/** Rewrites trusted text with each configured provider in turn (Qwen first, then Gemini). */
export async function simplifyText(text: string, list: Provider[], fetchImpl: typeof fetch = fetch): Promise<Response> {
  const attempts: Attempt[] = [];
  const budget = makeBudget();
  for (const [i, p] of list.entries()) {
    for (const model of p.text) {
      const wait = budget(p, list.slice(i + 1));
      if (!wait) break; // out of time for this provider: move on
      const out = await chat(
        p,
        model,
        {
          temperature: 0.2,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: `Trusted text from MedlinePlus:\n"""${text}"""` },
          ],
        },
        fetchImpl,
        attempts,
        wait,
      );
      if (out) return Response.json({ text: out, provider: p.name, model });
      if (accountBlocked(attempts)) break; // not activated or bad key: go straight to the next provider
    }
  }
  console.log('simplify: all providers failed', JSON.stringify(attempts));
  return new Response('The AI is busy. Please try again.', { status: 503 });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const list = providers();
  if (!list.length) return new Response('AI is not configured (no QWEN_API_KEY or GEMINI_API_KEY).', { status: 503 });
  let body: { text?: unknown };
  try {
    body = (await req.json()) as { text?: unknown };
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 4000) return new Response('Text must be 1–4000 characters.', { status: 400 });
  return simplifyText(text, list);
}
