import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `base` is './' so the build works from any sub-path (e.g. GitHub Pages).
/**
 * Local stand-in for the Vercel function api/tts.ts, so "Listen" works with
 * `npm run dev` / `npm run preview` when KHAYA_API_KEY is set in .env.local.
 */
function localTts(): Plugin {
  const handler = async (req: import('http').IncomingMessage, res: import('http').ServerResponse, next: () => void) => {
    const path = req.url?.split('?')[0];
    if (path === '/api/identify' && req.method === 'POST') return identify(req, res);
    if (path === '/api/simplify' && req.method === 'POST') return simplify(req, res);
    if (path !== '/api/tts' || req.method !== 'POST') return next();
    const env = loadEnv('development', process.cwd(), '');
    const key = env.KHAYA_API_KEY || process.env.KHAYA_API_KEY;
    if (!key) {
      res.statusCode = 503;
      return res.end('Set KHAYA_API_KEY in .env.local to use text-to-speech locally.');
    }
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const { text, language } = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    if (process.env.HTTPS_PROXY) {
      const { ProxyAgent, setGlobalDispatcher } = await import('undici');
      setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY));
    }
    const up = await fetch('https://translation-api.ghananlp.org/tts/v1/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': key },
      body: JSON.stringify({ text, language, speaker_id: 'female' }),
    });
    res.statusCode = up.ok ? 200 : 502;
    res.setHeader('Content-Type', up.headers.get('Content-Type') ?? 'audio/wav');
    res.end(Buffer.from(await up.arrayBuffer()));
  };
  // Local stand-in for api/identify.ts (AI pack reading: Qwen, then Gemini).
  const identify = async (req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
    const env = loadEnv('development', process.cwd(), '');
    const { providers } = await import('./api/_providers');
    const list = providers({ ...process.env, ...env });
    if (!list.length) {
      res.statusCode = 503;
      return res.end('Set QWEN_API_KEY or GEMINI_API_KEY in .env.local to use AI pack reading locally.');
    }
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const { image } = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    if (process.env.HTTPS_PROXY) {
      const { ProxyAgent, setGlobalDispatcher } = await import('undici');
      setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY));
    }
    const { identifyPack } = await import('./api/identify');
    const out = await identifyPack(image, list);
    res.statusCode = out.status;
    res.setHeader('Content-Type', out.headers.get('Content-Type') ?? 'application/json');
    res.end(await out.text());
  };
  // Local stand-in for api/simplify.ts (AI summary of trusted text).
  const simplify = async (req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
    const env = loadEnv('development', process.cwd(), '');
    const { providers } = await import('./api/_providers');
    const list = providers({ ...process.env, ...env });
    if (!list.length) {
      res.statusCode = 503;
      return res.end('Set QWEN_API_KEY or GEMINI_API_KEY in .env.local to use AI summaries locally.');
    }
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const { text } = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    if (process.env.HTTPS_PROXY) {
      const { ProxyAgent, setGlobalDispatcher } = await import('undici');
      setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY));
    }
    const { simplifyText } = await import('./api/simplify');
    const out = await simplifyText(text, list);
    res.statusCode = out.status;
    res.setHeader('Content-Type', out.headers.get('Content-Type') ?? 'application/json');
    res.end(await out.text());
  };
  return {
    name: 'local-tts',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    localTts(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'MediTrust Ghana',
        short_name: 'MediTrust',
        description: 'Check a medicine against your health profile before you take it.',
        start_url: './#/app',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F2F8F7',
        theme_color: '#0E9384',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The text-reading engine is large: cache it the first time it is used instead of up front.
        globIgnores: ['tesseract/**'],
        runtimeCaching: [
          {
            urlPattern: /\/tesseract\//,
            handler: 'CacheFirst',
            options: { cacheName: 'ocr-engine', expiration: { maxEntries: 10 } },
          },
        ],
      },
    }),
  ],
});
