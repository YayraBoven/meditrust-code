/**
 * The AI providers MediTrust can use, tried in order. Both speak the same
 * OpenAI-compatible chat format, so one request shape works for both.
 *
 *   1. Alibaba Qwen (Model Studio, international region)  – key: QWEN_API_KEY
 *   2. Google Gemini                                      – key: GEMINI_API_KEY
 *
 * A provider without a key is skipped. If every provider fails, the caller
 * gets a 503 and the app falls back to reading the photo on the phone.
 * Files starting with "_" in /api are not deployed as routes by Vercel.
 */

export interface Provider {
  name: 'qwen' | 'gemini';
  endpoint: string;
  /** Models for reading photos, best first. */
  vision: string[];
  /** Models for rewriting text, best first. */
  text: string[];
  /** Whether the provider accepts response_format json_schema (else json_object + schema in the prompt). */
  jsonSchema: boolean;
  key: string | undefined;
}

type Env = Record<string, string | undefined>;

export function providers(env: Env = process.env): Provider[] {
  const list: Provider[] = [
    {
      name: 'qwen',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
      vision: ['qwen3-vl-plus', 'qwen-vl-max', 'qwen-vl-plus'],
      text: ['qwen-plus', 'qwen-turbo'],
      jsonSchema: false,
      key: env.QWEN_API_KEY,
    },
    {
      name: 'gemini',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      vision: ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'],
      text: ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'],
      jsonSchema: true,
      key: env.GEMINI_API_KEY,
    },
  ];
  // Optional override for testing, e.g. AI_ORDER=gemini,qwen or AI_ORDER=qwen
  const order = env.AI_ORDER?.split(',').map((s) => s.trim()).filter(Boolean);
  const ordered = order?.length ? order.map((n) => list.find((p) => p.name === n)).filter((p): p is Provider => !!p) : list;
  return ordered.filter((p) => !!p.key);
}

export interface Attempt {
  provider: string;
  model: string;
  status: number | 'timeout' | 'error';
  /** Short error code from the provider (never the key), to diagnose setup problems. */
  code?: string;
}

/** Calls one chat completion; returns the message text or null (busy, over quota, bad reply). */
export async function chat(
  p: Provider,
  model: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
  attempts: Attempt[] = [],
  timeoutMs = 20000,
): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(p.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
      body: JSON.stringify({ model, ...body }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      let code = '';
      try {
        const err = (await res.json()) as { error?: { code?: string; type?: string }; code?: string };
        code = String(err?.error?.code ?? err?.code ?? err?.error?.type ?? '').slice(0, 60);
      } catch {
        /* not JSON */
      }
      attempts.push({ provider: p.name, model, status: res.status, code });
      return null;
    }
    attempts.push({ provider: p.name, model, status: res.status });
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    attempts.push({ provider: p.name, model, status: (e as Error)?.name === 'AbortError' ? 'timeout' : 'error' });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Pulls a JSON object out of a reply that may be wrapped in ``` fences or text. */
export function parseJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}
