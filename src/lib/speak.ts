import { useEffect, useRef, useState } from 'react';
import { langInfo, type Lang } from '../i18n';

/**
 * Read a result aloud. English uses the phone's own voice. Twi, Ewe, Ga and
 * Dagbani use GhanaNLP's Khaya text-to-speech through our own server function
 * (/api/tts), so the API key never reaches the browser.
 */

const audioCache = new Map<string, string>(); // `${lang}|${text}` -> object URL

async function khayaAudio(text: string, lang: Lang, signal: AbortSignal): Promise<string> {
  const key = `${lang}|${text}`;
  const cached = audioCache.get(key);
  if (cached) return cached;
  const res = await fetch(new URL('api/tts', document.baseURI), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language: langInfo(lang).tts }),
    signal,
  });
  if (!res.ok) throw new Error(`tts ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  audioCache.set(key, url);
  return url;
}

export type SpeechState = 'idle' | 'loading' | 'speaking' | 'error';

export function useSpeech(text: string, lang: Lang) {
  const [state, setState] = useState<SpeechState>('idle');
  const audio = useRef<HTMLAudioElement | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const browserVoice = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const supported = lang === 'en' ? browserVoice : true;

  const stop = () => {
    ctrl.current?.abort();
    audio.current?.pause();
    if (browserVoice) window.speechSynthesis.cancel();
    setState('idle');
  };

  useEffect(() => stop, [text, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async () => {
    if (state === 'speaking' || state === 'loading') return stop();
    if (lang === 'en') {
      if (!browserVoice) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-GB';
      u.rate = 0.95;
      u.onend = () => setState('idle');
      u.onerror = () => setState('idle');
      window.speechSynthesis.speak(u);
      setState('speaking');
      return;
    }
    ctrl.current = new AbortController();
    setState('loading');
    try {
      const url = await khayaAudio(text, lang, ctrl.current.signal);
      const a = new Audio(url);
      audio.current = a;
      a.onended = () => setState('idle');
      a.onerror = () => setState('error');
      await a.play();
      setState('speaking');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setState('error');
    }
  };

  return { state, toggle, supported, speaking: state === 'speaking' };
}
