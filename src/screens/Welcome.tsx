import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Lock, ScanSearch, ShieldCheck, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo, Press } from '../components/ui';
import { DEMO_CASES } from '../data/demo';
import { useStartDemo } from '../lib/demo';
import { LanguagePicker } from '../components/LanguagePicker';
import { useT } from '../i18n';
import { useApp } from '../store/useApp';

const SLIDES = [
  {
    eyebrow: 'Medicine safety, made personal',
    title: 'Your health.',
    accent: 'Your safety.',
    body: 'Check a medicine against your own health profile before you take it.',
    Icon: ShieldCheck,
  },
  {
    eyebrow: 'Three checks in seconds',
    title: 'G6PD and pregnancy. Self-medication. Same ingredient twice.',
    accent: '',
    body: 'Clear rules decide the risk. MediTrust explains it in plain words and tells you who to ask.',
    Icon: ScanSearch,
  },
  {
    eyebrow: 'A pharmacist decides',
    title: 'We flag. Your pharmacist or doctor decides.',
    accent: '',
    body: 'MediTrust never diagnoses, prescribes or tells you to stop a medicine. Show your summary at the counter.',
    Icon: Stethoscope,
  },
];

export default function Welcome() {
  const [i, setI] = useState(0);
  const [stage, setStage] = useState<'slides' | 'consent'>('slides');
  const [agree, setAgree] = useState(false);
  const [showDemos, setShowDemos] = useState(false);
  const navigate = useNavigate();
  const startDemo = useStartDemo();
  const { setConsent, setOnboarded } = useApp();
  const t = useT();
  const last = i === SLIDES.length - 1;
  const slide = SLIDES[i];

  const next = () => (last ? setStage('consent') : setI(i + 1));

  return (
    <div className="no-scrollbar relative flex h-full flex-col overflow-y-auto bg-[radial-gradient(500px_300px_at_100%_0%,#DDF2EF,transparent_70%)] px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),24px)]">
      <div className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3">
          <LanguagePicker />
          {stage === 'slides' && (
            <button onClick={() => setStage('consent')} className="text-[13px] font-bold text-muted hover:text-navy-900">
              {t('Skip')}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {stage === 'slides' ? (
          <motion.div key="slides" exit={{ opacity: 0, y: -10 }} className="flex flex-1 flex-col">
            <motion.div
              key={i}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.25}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60 && !last) setI(i + 1);
                if (info.offset.x > 60 && i > 0) setI(i - 1);
              }}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-1 cursor-grab flex-col justify-center py-8 active:cursor-grabbing"
            >
              <div className="relative mb-10 flex h-[210px] items-center justify-center">
                <motion.div
                  className="absolute h-[200px] w-[200px] rounded-full bg-teal-100"
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute h-[140px] w-[140px] rounded-full bg-teal-200/70"
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                />
                <motion.div
                  initial={{ scale: 0.6, rotate: -8 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="relative flex h-24 w-24 items-center justify-center rounded-[28px] bg-teal-600 text-white shadow-[0_18px_40px_rgba(14,147,132,0.35)]"
                >
                  <slide.Icon size={44} strokeWidth={2} />
                </motion.div>
              </div>
              <div className="eyebrow mb-3">{t(slide.eyebrow)}</div>
              <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-tight text-navy-900">
                {t(slide.title)}
                {slide.accent && (
                  <>
                    <br />
                    <span className="text-teal-600">{t(slide.accent)}</span>
                  </>
                )}
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-muted">{t(slide.body)}</p>
            </motion.div>

            <div className="flex items-center justify-between pb-4">
              <div className="flex gap-2" role="tablist" aria-label="Intro slides">
                {SLIDES.map((_, d) => (
                  <button key={d} aria-label={`Slide ${d + 1}`} onClick={() => setI(d)} className="py-2">
                    <motion.span animate={{ width: d === i ? 26 : 8 }} className={`block h-2 rounded-full ${d === i ? 'bg-teal-600' : 'bg-teal-200'}`} />
                  </button>
                ))}
              </div>
              <Press onClick={next} className="flex items-center gap-1.5 rounded-2xl bg-teal-600 px-5 py-3.5 text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(14,147,132,0.28)]">
                {last ? t('Get started') : t('Next')} <ChevronRight size={18} />
              </Press>
            </div>
            <button onClick={() => setShowDemos(true)} className="pb-2 text-center text-[13px] font-bold text-teal-700 underline-offset-4 hover:underline">
              {t('Presenting? Try a demo patient')}
            </button>
          </motion.div>
        ) : (
          <motion.div key="consent" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="flex flex-1 flex-col pt-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
              <Lock size={26} />
            </div>
            <h1 className="mt-6 text-[28px] font-extrabold leading-tight tracking-tight text-navy-900">{t('Your health details stay on this phone')}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{t('To check medicines for you, MediTrust asks about your age, allergies, conditions, current medicines, pregnancy and G6PD status.')}</p>
            <ul className="mt-6 space-y-3">
              {[
                'Saved only on this device. No account, nothing sent to a server.',
                'Nothing is shared unless you tap Share.',
                'You can edit or delete your profile at any time.',
                'Handled in the spirit of Ghana’s Data Protection Act, 2012 (Act 843).',
              ].map((line, k) => (
                <motion.li key={line} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + k * 0.07 }} className="flex gap-3 text-[14px] leading-snug text-navy-900">
                  <ShieldCheck size={18} className="mt-0.5 shrink-0 text-teal-600" />
                  {t(line)}
                </motion.li>
              ))}
            </ul>
            <label className="mt-8 flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 accent-teal-600" />
              <span className="text-[14px] leading-snug text-navy-900">{t('I agree to MediTrust using my health details on this phone to check medicines for me.')}</span>
            </label>
            <div className="mt-auto space-y-3 pt-8">
              <Press
                disabled={!agree}
                onClick={() => {
                  setConsent(true);
                  setOnboarded(true);
                  navigate('/app/profile?setup=1', { replace: true });
                }}
                className="btn-primary"
              >
                {t('Build my health profile')}
              </Press>
              <button onClick={() => setShowDemos(true)} className="w-full py-2 text-[13px] font-bold text-teal-700">
                {t('Try a demo patient instead')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDemos && (
          <motion.div className="absolute inset-0 z-40 flex items-end bg-navy-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDemos(false)}>
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-t-[28px] bg-card p-6 pb-[max(env(safe-area-inset-bottom),24px)]"
            >
              <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-line" />
              <h2 className="text-[18px] font-extrabold text-navy-900">{t('Demo patients')}</h2>
              <p className="mb-4 mt-1 text-[13px] text-muted">{t('The four scenarios from the team document. Each loads a profile and a medicine to check.')}</p>
              <div className="space-y-2.5">
                {DEMO_CASES.map((d) => (
                  <Press key={d.id} onClick={() => startDemo(d.id)} className="flex w-full items-center justify-between rounded-2xl border border-line p-4 text-left hover:border-teal-200 hover:bg-teal-50">
                    <div>
                      <div className="text-[15px] font-bold text-navy-900">{d.name}</div>
                      <div className="text-[12.5px] text-muted">{t(d.summary)}</div>
                    </div>
                    <ChevronRight size={18} className="text-muted" />
                  </Press>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
