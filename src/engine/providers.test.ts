import { describe, expect, it } from 'vitest';
import { providers } from '../../api/_providers';
import { identifyPack } from '../../api/identify';
import { simplifyText } from '../../api/simplify';

const IMG = 'data:image/jpeg;base64,AAAA';
const pack = { is_medicine_pack: true, brand_name: 'Ibucare 200', active_ingredients: [{ name: 'Ibuprofen', strength: '200 mg' }], dosage_form: 'Tablet', manufacturer: '', text_seen: '', confidence: 'high' };
const reply = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

/** A fake network: each host answers with the given status or reply. */
function fakeFetch(answers: Record<string, () => Response>, calls: string[]) {
  return (async (url: RequestInfo | URL) => {
    const host = new URL(String(url)).host;
    calls.push(host);
    return (answers[host] ?? (() => new Response('down', { status: 503 })))();
  }) as typeof fetch;
}

describe('AI providers: Qwen first, Gemini as backup', () => {
  const env = { QWEN_API_KEY: 'q', GEMINI_API_KEY: 'g' };

  it('puts Qwen first and skips providers without a key', () => {
    expect(providers(env).map((p) => p.name)).toEqual(['qwen', 'gemini']);
    expect(providers({ GEMINI_API_KEY: 'g' }).map((p) => p.name)).toEqual(['gemini']);
    expect(providers({ ...env, AI_ORDER: 'gemini,qwen' }).map((p) => p.name)).toEqual(['gemini', 'qwen']);
  });

  it('uses Qwen when it works, even if its reply is wrapped in code fences', async () => {
    const calls: string[] = [];
    const res = await identifyPack(IMG, providers(env), fakeFetch({ 'dashscope-intl.aliyuncs.com': () => reply('```json\n' + JSON.stringify(pack) + '\n```') }, calls));
    const out = await res.json();
    expect(out.provider).toBe('qwen');
    expect(out.brand_name).toBe('Ibucare 200');
    expect(calls.every((h) => h.startsWith('dashscope'))).toBe(true);
  });

  it('falls back to Gemini when Qwen is over its limit', async () => {
    const calls: string[] = [];
    const res = await identifyPack(
      IMG,
      providers(env),
      fakeFetch({ 'dashscope-intl.aliyuncs.com': () => new Response('quota', { status: 429 }), 'generativelanguage.googleapis.com': () => reply(JSON.stringify(pack)) }, calls),
    );
    expect((await res.json()).provider).toBe('gemini');
    expect(calls[0]).toBe('dashscope-intl.aliyuncs.com');
  });

  it('returns 503 when every provider fails, so the phone reader takes over', async () => {
    const res = await identifyPack(IMG, providers(env), fakeFetch({}, []));
    expect(res.status).toBe(503);
  });

  it('summaries follow the same order', async () => {
    const res = await simplifyText('Trusted text.', providers(env), fakeFetch({ 'generativelanguage.googleapis.com': () => reply('Plain words. Ask a pharmacist or doctor if you have questions.') }, []));
    expect((await res.json()).provider).toBe('gemini');
  });
});
