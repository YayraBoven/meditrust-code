import { motion } from 'motion/react';
import { ArrowRight, Check, Pause, Pill, RotateCcw, Volume2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Disclaimer, Note, Press, Reveal, RiskBadge, StepHeader, riskStyle } from '../components/ui';
import { medicineById } from '../data/medicines';
import { CHECK_LABELS, displayLevel } from '../engine/checks';
import { LEVEL_COPY, composeWarning, flagText } from '../engine/explain';
import { firstName } from '../lib/demo';
import { useApp } from '../store/useApp';
import { useT } from '../i18n';
import { useSpeech } from '../lib/speak';
import { Loader2 } from 'lucide-react';

export default function Result() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { history, profile, resetDraft, lang } = useApp();
  const t = useT();
  const entry = history.find((h) => h.id === id);
  const r = entry?.result;
  const name = firstName(profile.name);
  const warning = r ? composeWarning(r, name, t) : '';
  const shown = r ? displayLevel(r) : 'low';
  const { state: speech, toggle, supported } = useSpeech(r ? `${t(LEVEL_COPY[shown].label)}. ${warning}` : '', lang);

  if (!r || !entry) {
    return (
      <div className="flex flex-1 flex-col">
        <StepHeader onBack={() => navigate('/app')} />
        <div className="p-6 text-muted">{t('This result is no longer on this phone.')}</div>
      </div>
    );
  }

  const meds = r.medicineIds.map(medicineById);
  const style = riskStyle[shown];
  const copy = LEVEL_COPY[shown];
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
              <div className="text-[12px] font-extrabold uppercase tracking-[0.14em]">{t(copy.label)}</div>
              <div className="text-[13px] font-semibold text-navy-900/70">{meds.map((m) => m?.brand).join(' + ')}</div>
            </div>
          </div>
          <h1 className="relative mt-4 text-[24px] font-extrabold leading-tight tracking-tight text-navy-900">{t(copy.headline)}</h1>
          <p className="relative mt-2 text-[15px] leading-relaxed text-navy-900">{warning}</p>
          {lang !== 'en' ? (
            <p className="relative mt-4 text-[12.5px] font-semibold text-navy-900/70">{t('Read-aloud in this language is coming soon.')}</p>
          ) : supported && (
            <Press onClick={toggle} className="relative mt-4 inline-flex items-center gap-2 rounded-xl bg-white/80 px-3.5 py-2 text-[13px] font-bold text-navy-900 shadow-sm">
              {speech === 'loading' ? <Loader2 size={15} className="animate-spin" /> : speech === 'speaking' ? <Pause size={15} /> : <Volume2 size={15} />}{' '}
              {t(speech === 'speaking' ? 'Stop' : speech === 'loading' ? 'Preparing audio…' : speech === 'error' ? 'Audio not available right now' : 'Listen to this result')}
            </Press>
          )}
        </motion.div>

        {r.flags.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-3 text-[15px] font-bold text-navy-900">{t('What we found')}</h2>
            <div className="space-y-3">
              {r.flags.map((f, k) => (
                <Reveal key={f.id} i={2 + k} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{t(CHECK_LABELS[f.check])}</span>
                    <RiskBadge level={f.level} />
                  </div>
                  <div className="mt-2 text-[15px] font-bold text-navy-900">{t(f.title)}</div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{flagText(f, t)}</p>
                  {f.detail && <p className="mt-1.5 text-[12px] font-semibold text-navy-700">{f.detail}</p>}
                </Reveal>
              ))}
            </div>
          </div>
        )}

        {(r.unassessed?.length ?? 0) > 0 && (
          <Reveal i={3} className="mt-6 rounded-2xl border border-[#D5DBE8] bg-[#EEF1F7] p-4">
            <div className="text-[13.5px] font-bold text-navy-900">{t('Not covered by our rules yet')}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-navy-700">
              {t('MediTrust does not yet have verified safety information for these ingredients. A pharmacist can check them for you.')}{' '}
              <span className="font-semibold">{r.unassessed.join(', ')}</span>
            </p>
          </Reveal>
        )}
        {(r.unknownRxStatus?.length ?? 0) > 0 && r.prescribed === false && (
          <Reveal i={3} className="mt-3 rounded-2xl border border-line bg-card p-4 text-[13px] leading-relaxed text-muted">
            {t('We do not know whether this medicine needs a prescription in Ghana. Ask your pharmacist.')} ({r.unknownRxStatus.join(', ')})
          </Reveal>
        )}

        <Reveal i={3} className="card mt-6 p-4">
          <h2 className="mb-3 text-[14px] font-bold text-navy-900">{t('Checks run')}</h2>
          <ul className="space-y-2.5">
            {r.checksRun.map((c) => (
              <li key={c.kind} className="flex items-center gap-3 text-[13.5px]">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${c.flagged ? 'bg-risk-mediumBg text-risk-medium' : 'bg-risk-lowBg text-risk-low'}`}>
                  {c.flagged ? '!' : <Check size={13} strokeWidth={3} />}
                </span>
                <span className="flex-1 font-semibold text-navy-900">{t(c.label)}</span>
                <span className="text-[12px] text-muted">{t(c.flagged ? 'Something to discuss' : 'Nothing found')}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-muted">
            {t(r.prescribed ? 'You said this was prescribed for you.' : 'You said you got this without a prescription (or were not sure).')}
          </div>
        </Reveal>

        <Reveal i={4} className="mt-4">
          <Note>{'The medicine data and rules in this prototype are illustrative and have not yet been reviewed by a pharmacist.'}</Note>
        </Reveal>

        <Reveal i={5} className="mt-6 space-y-3">
          <Press onClick={() => navigate(`/app/summary/${entry.id}`)} className="btn-primary">
            {t('Show to a pharmacist or doctor')} <ArrowRight size={18} />
          </Press>
          <Press
            onClick={() => {
              resetDraft();
              navigate('/app/check');
            }}
            className="btn-secondary"
          >
            <RotateCcw size={16} /> {t('Check another medicine')}
          </Press>
          <Disclaimer />
        </Reveal>

        <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted">
          <Pill size={12} /> {t('Rules decide the risk. The wording only explains it.')}
        </div>
      </div>
    </div>
  );
}
