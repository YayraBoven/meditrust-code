import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Medicine } from '../data/types';
import { passesSafetyFilter } from '../engine/explain';
import { aboutMedicine, shortSummary, type AboutEntry } from '../engine/medlineplus';
import { useT } from '../i18n';
import { Press } from './ui';

type AiState = { status: 'idle' | 'loading' | 'error' } | { status: 'done'; text: string };

/**
 * Trusted information first (MedlinePlus), then an optional AI rewrite of that
 * same text in simpler words, clearly labelled. The AI never adds its own facts.
 */
export function AboutMedicine({ medicine }: { medicine: Medicine }) {
  const t = useT();
  const [entries, setEntries] = useState<AboutEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [ai, setAi] = useState<AiState>({ status: 'idle' });

  useEffect(() => {
    const ctrl = new AbortController();
    aboutMedicine(medicine, ctrl.signal)
      .then(setEntries)
      .catch(() => setFailed(true));
    return () => ctrl.abort();
  }, [medicine]);

  const explain = async () => {
    if (!entries?.length) return;
    setAi({ status: 'loading' });
    try {
      const res = await fetch(new URL('api/simplify', document.baseURI), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: entries.map((e) => `${e.title}: ${e.summary}`).join('\n\n').slice(0, 3800) }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { text } = (await res.json()) as { text: string };
      // The same safety filter as every other generated text.
      setAi(passesSafetyFilter(text) ? { status: 'done', text } : { status: 'error' });
    } catch {
      setAi({ status: 'error' });
    }
  };

  return (
    <div className="card mt-6 p-4">
      <div className="flex items-center gap-2">
        <BookOpen size={17} className="text-teal-600" />
        <h2 className="text-[15px] font-bold text-navy-900">
          {t('About this medicine')} <span className="font-semibold text-muted">· {medicine.brand}</span>
        </h2>
      </div>

      {!entries && !failed && (
        <div className="mt-3 space-y-2" aria-busy="true">
          <div className="h-3 w-full animate-pulse rounded bg-teal-100" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-teal-100" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-canvas" />
        </div>
      )}

      {(failed || (entries && entries.length === 0)) && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{t('No trusted information found for this medicine. Ask your pharmacist about what it is for.')}</p>
      )}

      {entries && entries.length > 0 && (
        <>
          <ul className="mt-3 space-y-3">
            {entries.map((e) => (
              <li key={e.url}>
                <div className="text-[13.5px] font-bold text-navy-900">{e.title}</div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-navy-900/85">{shortSummary(e.summary)}</p>
                <a href={e.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-bold text-teal-700">
                  {t('Read more on MedlinePlus')} <ExternalLink size={12} />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11.5px] text-muted">{t('Source: MedlinePlus, U.S. National Library of Medicine (in English). General information, not advice for you.')}</p>

          <div className="mt-4 border-t border-line pt-4">
            {ai.status !== 'done' ? (
              <Press onClick={explain} disabled={ai.status === 'loading'} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-[13.5px] font-bold text-teal-800 disabled:opacity-70">
                {ai.status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {t(ai.status === 'loading' ? 'Writing a simpler version…' : ai.status === 'error' ? 'AI summary not available. Try again' : 'Explain in simple words (AI)')}
              </Press>
            ) : (
              <AnimatePresence>
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-[#D5DBE8] bg-[#EEF1F7] p-3.5">
                  <div className="flex items-center gap-1.5 text-[11.5px] font-extrabold uppercase tracking-wider text-navy-700">
                    <Sparkles size={13} /> {t('In simple words · AI summary')}
                  </div>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-navy-900">{ai.text}</p>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-navy-700">{t('Written by AI (Google Gemini) from the MedlinePlus text above only. It may contain mistakes, so check with a pharmacist.')}</p>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </>
      )}
    </div>
  );
}
