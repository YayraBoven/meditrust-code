import { motion } from 'motion/react';
import { ArrowRight, Check, Pause, Pill, RotateCcw, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Disclaimer, Note, Press, Reveal, RiskBadge, StepHeader, riskStyle } from '../components/ui';
import { medicineById } from '../data/medicines';
import { CHECK_LABELS } from '../engine/checks';
import { LEVEL_COPY, composeWarning } from '../engine/explain';
import { firstName } from '../lib/demo';
import { useApp } from '../store/useApp';

export function useSpeech(text: string) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);
  const toggle = () => {
    if (!supported) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };
  return { speaking, toggle, supported };
}

export default function Result() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { history, profile, resetDraft } = useApp();
  const entry = history.find((h) => h.id === id);
  const r = entry?.result;
  const name = firstName(profile.name);
  const warning = r ? composeWarning(r, name) : '';
  const { speaking, toggle, supported } = useSpeech(r ? `${LEVEL_COPY[r.level].label}. ${warning}` : '');

  if (!r || !entry) {
    return (
      <div className="flex flex-1 flex-col">
        <StepHeader onBack={() => navigate('/app')} />
        <div className="p-6 text-muted">This result is no longer on this phone.</div>
      </div>
    );
  }

  const meds = r.medicineIds.map(medicineById);
  const style = riskStyle[r.level];
  const copy = LEVEL_COPY[r.level];
  const Icon = style.Icon;

  return (
    <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto">
      <StepHeader step={5} onBack={() => navigate('/app')} />
      <div className="px-5 pb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={`relative overflow-hidden rounded-xl3 border p-5 ${style.wrap}`}
        >
          <motion.div className={`absolute -right-14 -top-14 h-32 w-32 rounded-full opacity-[0.12] ${style.dot}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.8, delay: 0.1 }} />
          <div className="relative flex items-center gap-3">
            <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.15 }} className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white ${style.dot}`}>
              <Icon size={28} strokeWidth={2.2} />
            </motion.span>
            <div>
              <div className="text-[12px] font-extrabold uppercase tracking-[0.14em]">{copy.label}</div>
              <div className="text-[13px] font-semibold text-navy-900/70">{meds.map((m) => m?.brand).join(' + ')}</div>
            </div>
          </div>
          <h1 className="relative mt-4 text-[24px] font-extrabold leading-tight tracking-tight text-navy-900">{copy.headline}</h1>
          <p className="relative mt-2 text-[15px] leading-relaxed text-navy-900">{warning}</p>
          {supported && (
            <Press onClick={toggle} className="relative mt-4 inline-flex items-center gap-2 rounded-xl bg-white/80 px-3.5 py-2 text-[13px] font-bold text-navy-900 shadow-sm">
              {speaking ? <Pause size={15} /> : <Volume2 size={15} />} {speaking ? 'Stop' : 'Listen to this result'}
            </Press>
          )}
        </motion.div>

        {r.flags.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-3 text-[15px] font-bold text-navy-900">What we found</h2>
            <div className="space-y-3">
              {r.flags.map((f, k) => (
                <Reveal key={f.id} i={2 + k} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{CHECK_LABELS[f.check]}</span>
                    <RiskBadge level={f.level} />
                  </div>
                  <div className="mt-2 text-[15px] font-bold text-navy-900">{f.title}</div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{f.message}</p>
                </Reveal>
              ))}
            </div>
          </div>
        )}

        <Reveal i={3} className="card mt-6 p-4">
          <h2 className="mb-3 text-[14px] font-bold text-navy-900">Checks run</h2>
          <ul className="space-y-2.5">
            {r.checksRun.map((c) => (
              <li key={c.kind} className="flex items-center gap-3 text-[13.5px]">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${c.flagged ? 'bg-risk-mediumBg text-risk-medium' : 'bg-risk-lowBg text-risk-low'}`}>
                  {c.flagged ? '!' : <Check size={13} strokeWidth={3} />}
                </span>
                <span className="flex-1 font-semibold text-navy-900">{c.label}</span>
                <span className="text-[12px] text-muted">{c.flagged ? 'Something to discuss' : 'Nothing found'}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-muted">
            {r.prescribed ? 'You said this was prescribed for you.' : 'You said you got this without a prescription (or were not sure).'}
          </div>
        </Reveal>

        <Reveal i={4} className="mt-4">
          <Note>The medicine data and rules in this prototype are illustrative and have not yet been reviewed by a pharmacist.</Note>
        </Reveal>

        <Reveal i={5} className="mt-6 space-y-3">
          <Press onClick={() => navigate(`/app/summary/${entry.id}`)} className="btn-primary">
            Show to a pharmacist or doctor <ArrowRight size={18} />
          </Press>
          <Press
            onClick={() => {
              resetDraft();
              navigate('/app/check');
            }}
            className="btn-secondary"
          >
            <RotateCcw size={16} /> Check another medicine
          </Press>
          <Disclaimer />
        </Reveal>

        <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted">
          <Pill size={12} /> Rules decide the risk. The wording only explains it.
        </div>
      </div>
    </div>
  );
}
