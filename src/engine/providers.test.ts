import { describe, expect, it } from 'vitest';
import { makeBudget, providers } from '../../api/_providers';
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

describe('account problems', () => {
  it('skips the rest of Qwen when the key itself is refused', async () => {
    const calls: string[] = [];
    const res = await identifyPack(
      IMG,
      providers({ QWEN_API_KEY: 'q', GEMINI_API_KEY: 'g' }),
      fakeFetch({ 'dashscope-intl.aliyuncs.com': () => Response.json({ error: { code: 'InvalidApiKey' } }, { status: 401 }), 'generativelanguage.googleapis.com': () => reply(JSON.stringify(pack)) }, calls),
    );
    const out = await res.json();
    expect(out.provider).toBe('gemini');
    expect(calls.filter((h) => h.startsWith('dashscope')).length).toBe(1);
    expect(out.tried[0].code).toBe('InvalidApiKey');
  });

  it('tries the next Qwen model when one model is not included in the plan', async () => {
    let n = 0;
    const f = (async () => (++n === 1 ? Response.json({ error: { code: 'AccessDenied.Unpurchased' } }, { status: 403 }) : reply(JSON.stringify(pack)))) as unknown as typeof fetch;
    const out = await (await identifyPack(IMG, providers({ QWEN_API_KEY: 'q' }), f)).json();
    expect(out.provider).toBe('qwen');
    expect(out.tried.length).toBe(2);
  });
});

describe('speed and time limits', () => {
  it('turns off Qwen "thinking" mode, which made scans slow', async () => {
    let sent: Record<string, unknown> = {};
    const f = (async (_u: unknown, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return reply(JSON.stringify(pack));
    }) as unknown as typeof fetch;
    await identifyPack(IMG, providers({ QWEN_API_KEY: 'q' }), f);
    expect(sent.model).toBe('qwen3-vl-plus');
    expect(sent.enable_thinking).toBe(false);
  });

  it('always leaves time for Gemini after a slow Qwen', () => {
    let t = 0;
    const list = providers({ QWEN_API_KEY: 'q', GEMINI_API_KEY: 'g' });
    const budget = makeBudget(22000, () => t);
    expect(budget(list[0], [list[1]])).toBe(10000); // first Qwen try
    t = 10000;
    expect(budget(list[0], [list[1]])).toBe(3000); // a short second Qwen try still fits
    t = 13000;
    expect(budget(list[0], [list[1]])).toBe(0); // no more Qwen: Gemini's turn
    expect(budget(list[1], [])).toBe(9000); // Gemini gets the rest
  });
});

describe('prescription privacy', () => {
  it('removes a patient name-and-age line even if the AI lists it as a medicine', async () => {
    const { readPrescription, looksLikePerson } = await import('../../api/identify');
    expect(looksLikePerson({ name: 'Sushil 62' })).toBe(true);
    expect(looksLikePerson({ name: 'Ama Mensah 28y' })).toBe(true);
    expect(looksLikePerson({ name: 'Mrs A. Owusu 45' })).toBe(true);
    expect(looksLikePerson({ name: 'Pilex', directions: 'tds 5d' })).toBe(false);
    expect(looksLikePerson({ name: 'Vitamin B12' })).toBe(false); // a number joined to a word is not an age
    expect(looksLikePerson({ name: 'Vitamin B12', strength: '1000mcg' })).toBe(false);
    const rx = { is_prescription: true, confidence: 'high', medicines: [
      { name: 'Sushil 62', strength: '', form: '', directions: '', name_legibility: 'clear', dose_legibility: 'none' },
      { name: 'Pilex', strength: '', form: 'tab', directions: 'tds 5d', name_legibility: 'clear', dose_legibility: 'none' },
    ] };
    const res = await readPrescription(IMG, providers({ QWEN_API_KEY: 'q' }), fakeFetch({ 'dashscope-intl.aliyuncs.com': () => reply(JSON.stringify(rx)) }, []));
    const out = await res.json();
    expect(out.medicines.map((m: { name: string }) => m.name)).toEqual(['Pilex']);
    expect(JSON.stringify(out)).not.toContain('Sushil');
  });
});
