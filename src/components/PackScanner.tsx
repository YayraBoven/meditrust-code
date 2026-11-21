import { AnimatePresence, motion } from 'motion/react';
import { Camera, ChevronRight, Database, ImageUp, Keyboard, Lightbulb, Pill, RotateCcw, ScanText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ingredientNames } from '../data/medicines';
import type { Medicine } from '../data/types';
import { candidateWords, findMedicinesInText, preloadOcr, readPackText, spottedTerms, unknownBrandPhrases, type Crop } from '../engine/ocr';
import { aiReadPack, factChips, medicinesFromFacts } from '../engine/aiRead';
import { useApp } from '../store/useApp';
import { searchRxNorm } from '../engine/rxnorm';
import { Press } from './ui';
import { useT } from '../i18n';

type Stage = 'start' | 'camera' | 'reading' | 'results' | 'error';

interface Found {
  local: Medicine[];
  remote: Medicine[];
  text: string;
  words: number;
  /** Set when the AI reader was used: what it read on the pack. */
  chips?: string[];
  by: 'ai' | 'device';
}

/**
 * The part of the camera frame inside the on-screen guide box (plus a margin),
 * allowing for the video being scaled to cover its container.
 */
function guideCrop(v: HTMLVideoElement): Crop | undefined {
  const W = v.clientWidth;
  const H = v.clientHeight;
  const vw = v.videoWidth;
  const vh = v.videoHeight;
  if (!W || !H || !vw || !vh) return undefined;
  const s = Math.max(W / vw, H / vh);
  const ox = (vw * s - W) / 2;
  const oy = (vh * s - H) / 2;
  const pad = 0.06;
  const gx = 24 - W * pad;
  const gy = H * 0.29 - H * pad;
  const gw = W - 48 + 2 * W * pad;
  const gh = H * 0.42 + 2 * H * pad;
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const x = clamp((gx + ox) / s / vw);
  const y = clamp((gy + oy) / s / vh);
  return { x, y, w: clamp((gw / s) / vw + x) - x, h: clamp((gh / s) / vh + y) - y };
}

export function PackScanner({ onPick, onType }: { onPick: (m: Medicine) => void; onType: () => void }) {
  const t = useT();
  const [stage, setStage] = useState<Stage>('start');
  const [reader, setReader] = useState<'ai' | 'device'>('ai');
  const addExternal = useApp((s) => s.addExternal);
  const [progress, setProgress] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const canStream = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;

  // Callback ref: the <video> mounts after the entrance animation, so attach the stream then.
  const attachVideo = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      void el.play().catch(() => undefined);
      // Bring the viewfinder and shutter button into view on small screens.
      setTimeout(() => el.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    preloadOcr();
    return stopCamera;
  }, []);

  const openCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = stream;
      setStage('camera'); // the viewfinder attaches the stream when it mounts (see attachVideo)
    } catch {
      // Permission refused or no camera: fall back to the phone's own camera app / gallery.
      captureRef.current?.click();
    }
  };

  const read = async (source: Blob | HTMLCanvasElement, preview: string, crop?: Crop) => {
    setPhoto(preview);
    setStage('reading');
    setProgress(0);
    // 1. AI reading (Google Gemini) when online. Falls back to the on-device reader on any problem.
    if (navigator.onLine) {
      setReader('ai');
      let fake = 0.05;
      const tick = setInterval(() => setProgress((fake = Math.min(0.92, fake + 0.04))), 400);
      try {
        const facts = await aiReadPack(source, crop);
        clearInterval(tick);
        setProgress(1);
        const meds = medicinesFromFacts(facts);
        meds.filter((m) => m.source === 'photo').forEach(addExternal);
        if (meds.length || facts.is_medicine_pack === false) {
          setFound({ local: meds, remote: [], text: facts.text_seen, words: facts.text_seen.split(/\s+/).length, chips: factChips(facts), by: 'ai' });
          setStage('results');
          return;
        }
      } catch {
        // AI unavailable (offline, busy, not configured): use the on-device reader below.
      } finally {
        clearInterval(tick);
      }
    }
    // 2. On-device reading (Tesseract), photo never leaves the phone.
    setReader('device');
    setProgress(0);
    try {
      const { text, words } = await readPackText(source, setProgress, crop);
      const local = findMedicinesInText(text, 3).map((m) => m.medicine);
      // Brand names we do not know are looked up in the wider database, even when
      // something matched locally (e.g. "Panadol Extra" on a paracetamol pack).
      const phrases = unknownBrandPhrases(text);
      if (!local.length) phrases.push(...candidateWords(text).slice(0, 2));
      let remote: Medicine[] = [];
      for (const ph of phrases) {
        try {
          remote = await searchRxNorm(ph, undefined, 2);
        } catch {
          remote = [];
        }
        if (remote.length) break;
      }
      const localSets = new Set(local.map((m) => [...m.ingredients].sort().join('|')));
      remote = remote.filter((m) => !localSets.has([...m.ingredients].sort().join('|')) || m.brand.toLowerCase() !== m.generic.toLowerCase());
      setFound({ local, remote, text, words, by: 'device' });
      setStage('results');
    } catch {
      setError('The text reader could not start. Check your connection the first time you use it, then try again.');
      setStage('error');
    }
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    const preview = c.toDataURL('image/jpeg', 0.7);
    const crop = guideCrop(v);
    stopCamera();
    void read(c, preview, crop);
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    stopCamera();
    void read(f, URL.createObjectURL(f));
  };

  const reset = () => {
    setFound(null);
    setPhoto(null);
    setStage('start');
  };

  const spotted = found ? (found.chips ?? spottedTerms(found.text)) : [];
  const nothing = found && !found.local.length && !found.remote.length;
  const unreadable = !!found && nothing && found.words < 3;

  return (
    <div className="mt-4">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label={t('Upload a photo of the pack')} />
      <input ref={captureRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label={t('Take a photo of the pack')} />

      <AnimatePresence mode="wait">
        {stage === 'start' && (
          <motion.div key="start" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-xl3 bg-navy-900 text-center text-white">
              <div className="absolute inset-6 rounded-2xl border-2 border-dashed border-white/25" />
              <motion.div className="absolute left-6 right-6 h-0.5 bg-teal-500 shadow-[0_0_16px_#14A594]" animate={{ top: ['22%', '78%', '22%'] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
              <ScanText size={36} className="relative opacity-90" />
              <div className="relative mt-3 text-[15px] font-bold">{t('Scan the medicine pack')}</div>
              <div className="relative mt-1 max-w-[250px] text-[12.5px] text-white/70">{t('Point at the side with the medicine name. AI (Google Gemini) reads the photo only to find the medicine. Your name and health profile are never sent.')}</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Press onClick={canStream ? openCamera : () => captureRef.current?.click()} className="btn-primary">
                <Camera size={18} /> {t('Open camera')}
              </Press>
              <Press onClick={() => fileRef.current?.click()} className="btn-secondary">
                <ImageUp size={18} /> {t('Upload photo')}
              </Press>
            </div>
            <ul className="mt-4 space-y-1.5 text-[12.5px] text-muted">
              {['Good light, no glare on the shiny box', 'Fill the frame with the name and strength', 'Hold still for a second'].map((tip) => (
                <li key={tip} className="flex items-center gap-2">
                  <Lightbulb size={13} className="text-teal-600" /> {t(tip)}
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {stage === 'camera' && (
          <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="relative aspect-[4/5] max-h-[52vh] w-full overflow-hidden rounded-xl3 bg-black">
              <video ref={attachVideo} playsInline muted autoPlay className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-x-6 top-1/2 h-[42%] -translate-y-1/2 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(14,27,51,0.45)]" />
                <motion.div className="absolute inset-x-8 h-0.5 bg-teal-500 shadow-[0_0_14px_#14A594]" animate={{ top: ['32%', '68%', '32%'] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
                <div className="absolute inset-x-0 top-4 text-center text-[12.5px] font-semibold text-white">{t('Fit the medicine name inside the box')}</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => {
                  stopCamera();
                  setStage('start');
                }}
                className="w-20 text-[13px] font-bold text-muted"
              >
                {t('Cancel')}
              </button>
              <Press onClick={capture} aria-label={t('Take photo')} className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-teal-200 bg-teal-600 shadow-[0_10px_24px_rgba(14,147,132,0.4)]">
                <span className="h-12 w-12 rounded-full border-2 border-white/80" />
              </Press>
              <button
                onClick={() => {
                  stopCamera();
                  fileRef.current?.click();
                }}
                className="w-20 text-right text-[13px] font-bold text-teal-700"
              >
                {t('Upload')}
              </button>
            </div>
          </motion.div>
        )}

        {stage === 'reading' && (
          <motion.div key="reading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl3 bg-navy-900">
              {photo && <img src={photo} alt={t('Your photo of the pack')} className="h-full w-full object-cover opacity-70" />}
              <motion.div className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-teal-500/40 to-transparent" animate={{ top: ['-10%', '90%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }} />
            </div>
            <div className="mt-4 text-[15px] font-bold text-navy-900">{t('Reading the pack…')}</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-teal-100">
              <motion.div className="h-full rounded-full bg-teal-600" animate={{ width: `${Math.round(progress * 100)}%` }} transition={{ ease: 'easeOut' }} />
            </div>
            <div className="mt-1.5 text-[12px] text-muted">{t(reader === 'ai' ? 'AI is reading the medicine name and strength' : progress < 0.2 ? 'Getting the text reader ready (first time only)' : 'Looking for the medicine name')}</div>
          </motion.div>
        )}

        {stage === 'results' && found && (
          <motion.div key="results" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="flex gap-3 rounded-2xl bg-card p-3 shadow-card">
              {photo && <img src={photo} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{t(found.by === 'ai' ? 'Read by AI' : 'We spotted')}</div>
                {spotted.length ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {spotted.map((term) => (
                      <span key={term} className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[12px] font-semibold text-teal-800">
                        {term}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-[12.5px] leading-snug text-navy-900">{t(nothing ? 'No medicine name we could recognise' : 'A medicine name (see below)')}</div>
                )}
              </div>
            </div>

            {nothing ? (
              <div className="mt-5 text-center">
                <div className="text-[16px] font-bold text-navy-900">{t(unreadable ? 'The photo was hard to read' : 'We could not find a medicine name')}</div>
                <p className="mx-auto mt-1 max-w-[290px] text-[13px] text-muted">{t('Hold the pack flat, avoid shine from lights, and fill the box with the medicine name. Or type the name instead.')}</p>
              </div>
            ) : (
              <>
                <div className="mb-2 mt-5 text-[13px] font-bold text-navy-900">{t('Is it one of these?')}</div>
                <ul className="space-y-2">
                  {[...found.remote, ...found.local].map((m, k) => (
                    <motion.li key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: k * 0.05 } }}>
                      <Press onClick={() => onPick(m)} className="card flex w-full items-center gap-3 p-3.5 text-left hover:border-teal-200">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.source === 'rxnorm' ? 'bg-navy-900/5 text-navy-800' : 'bg-teal-100 text-teal-700'}`}>
                          {m.source === 'rxnorm' ? <Database size={18} /> : <Pill size={18} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px] font-bold text-navy-900">{m.brand}</span>
                          <span className="block truncate text-[12.5px] text-muted">
                            {ingredientNames(m).join(' + ')}
                            {m.strength ? ` · ${m.strength}` : ''}
                            {m.source === 'rxnorm' ? ' · RxNorm' : ''}
                          </span>
                        </span>
                        <ChevronRight size={18} className="text-muted" />
                      </Press>
                    </motion.li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Press onClick={reset} className="btn-secondary">
                <RotateCcw size={16} /> {t('Scan again')}
              </Press>
              <Press onClick={onType} className="btn-secondary">
                <Keyboard size={16} /> {t('Type it')}
              </Press>
            </div>
          </motion.div>
        )}

        {stage === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl bg-card p-5 text-center shadow-card">
            <div className="text-[15px] font-bold text-navy-900">{t('Something went wrong')}</div>
            <p className="mt-1 text-[13px] text-muted">{t(error)}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Press onClick={reset} className="btn-secondary">
                {t('Try again')}
              </Press>
              <Press onClick={onType} className="btn-secondary">
                {t('Type it')}
              </Press>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
