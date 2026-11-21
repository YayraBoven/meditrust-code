import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Baby, ChevronRight, Droplets, HeartPulse, History, LifeBuoy, Pill, Search, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/Shell';
import { Logo, Press, Reveal, RiskBadge, SectionTitle } from '../components/ui';
import { DEMO_CASES } from '../data/demo';
import { medicineById } from '../data/medicines';
import { displayLevel } from '../engine/checks';
import { firstName } from '../lib/demo';
import { useApp } from '../store/useApp';
import { LanguagePicker } from '../components/LanguagePicker';
import { useT } from '../i18n';

const TIPS = [
  'Two brands can hold the same ingredient. Check both.',
  'Not sure about G6PD? Ask a pharmacist about a test.',
  'Antibiotics work best with a prescription and the full course.',
  'Pregnant? Check every medicine, even familiar ones.',
];

const GREETINGS = ['Good morning', 'Good afternoon', 'Good evening'];

function greeting() {
  const h = new Date().getHours();
  return GREETINGS[h < 12 ? 0 : h < 17 ? 1 : 2];
}

export default function Home() {
  const navigate = useNavigate();
  const { profile, history, demoId, setDraft, resetDraft } = useApp();
  const t = useT();
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTip((n) => (n + 1) % TIPS.length), 4200);
    return () => clearInterval(timer);
  }, []);
  const name = firstName(profile.name);
  const last = history[0];
  const demo = DEMO_CASES.find((d) => d.id === demoId);

  const startCheck = (query = '') => {
    resetDraft();
    setDraft({ query });
    navigate('/app/check');
  };

  const glance = [
    { Icon: Baby, label: 'Pregnancy', value: profile.pregnancy === 'pregnant' ? `${t('Pregnant')}${profile.trimester ? ` · T${profile.trimester}` : ''}` : t(profile.pregnancy === 'breastfeeding' ? 'Breastfeeding' : 'Not pregnant') },
    { Icon: Droplets, label: 'G6PD', value: t({ deficient: 'Deficient', normal: 'Normal', 'family-history': 'Family history', 'not-sure': 'Not sure', 'never-tested': 'Not tested' }[profile.g6pd]) },
    { Icon: HeartPulse, label: 'Conditions', value: profile.conditions.length ? String(profile.conditions.length) : t('None') },
    { Icon: Pill, label: 'Medicines', value: profile.currentMedicines.length ? String(profile.currentMedicines.length) : t('None') },
  ];

  return (
    <>
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="bg-[radial-gradient(420px_260px_at_100%_0%,#DDF2EF,transparent_70%)] px-5 pb-6 pt-[max(env(safe-area-inset-top),20px)]">
          <div className="flex items-center justify-between">
            <Logo size={32} />
            <div className="flex items-center gap-2">
              <LanguagePicker />
              <Press onClick={() => navigate('/app/help')} aria-label={t('Get help')} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-navy-900 shadow-card">
                <LifeBuoy size={18} />
              </Press>
            </div>
          </div>

          <Reveal i={1} className="mt-6">
            <h1 className="text-[26px] font-extrabold tracking-tight text-navy-900">
              {t(greeting())}
              {name ? `, ${name}` : ''} <span className="inline-block origin-[70%_70%] animate-[wave_2.4s_ease-in-out_1]">👋</span>
            </h1>
            <p className="mt-1 text-[14px] text-muted">{t('Check a medicine before you take it.')}</p>
          </Reveal>

          <Reveal i={2}>
            <Press onClick={() => startCheck()} className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-4 text-left shadow-card">
              <Search size={18} className="text-teal-600" />
              <span className="flex-1 text-[15px] font-medium text-muted">{t('Type a medicine name…')}</span>
              <span className="rounded-xl bg-teal-600 p-2 text-white">
                <ArrowRight size={16} />
              </span>
            </Press>
          </Reveal>

          <Reveal i={3} className="mt-3 flex h-9 items-center gap-2 overflow-hidden rounded-xl bg-teal-100/70 px-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">{t('Tip')}</span>
            <div className="relative h-5 flex-1 overflow-hidden">
              <AnimatePresence mode="popLayout">
                <motion.p key={tip} initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -18, opacity: 0 }} transition={{ duration: 0.4 }} className="absolute inset-0 truncate text-[12.5px] font-semibold text-teal-800">
                  {t(TIPS[tip])}
                </motion.p>
              </AnimatePresence>
            </div>
          </Reveal>

          {demo && (
            <Reveal i={4} className="mt-5">
              <Press onClick={() => startCheck(demo.check.query)} className="relative w-full overflow-hidden rounded-xl3 bg-navy-900 p-5 text-left text-white">
                <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-teal-600/40 blur-2xl" />
                <div className="relative">
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-200">{t('Demo patient')} · {demo.name}</div>
                  <div className="mt-2 text-[18px] font-bold leading-snug">{t('Run the demo check')}: {demo.check.query}</div>
                  <div className="mt-1 text-[13px] text-white/70">{t(demo.summary)}</div>
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-teal-500 px-3.5 py-2 text-[13px] font-bold">
                    {t('Start')} <ArrowRight size={15} />
                  </div>
                </div>
              </Press>
            </Reveal>
          )}

          <Reveal i={5} className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: 'My profile', Icon: UserRound, to: '/app/profile' },
              { label: 'Past checks', Icon: History, to: '/app/history' },
              { label: 'Get help', Icon: LifeBuoy, to: '/app/help' },
            ].map(({ label, Icon, to }) => (
              <Press key={label} onClick={() => navigate(to)} className="card flex flex-col items-center gap-2 px-2 py-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                  <Icon size={20} />
                </span>
                <span className="text-[12.5px] font-bold text-navy-900">{t(label)}</span>
              </Press>
            ))}
          </Reveal>

          {last && (
            <Reveal i={6} className="mt-6">
              <SectionTitle
                action={
                  <button onClick={() => navigate('/app/history')} className="text-[12.5px] font-bold text-teal-700">
                    {t('View all')}
                  </button>
                }
              >
                {t('Last check')}
              </SectionTitle>
              <Press onClick={() => navigate(`/app/summary/${last.id}`)} className="card flex w-full items-center gap-3 p-4 text-left">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-canvas text-navy-900">
                  <Pill size={20} />
                </span>
                <span className="flex-1">
                  <span className="block text-[14px] font-bold text-navy-900">{last.result.medicineIds.map((id) => medicineById(id)?.brand).join(' + ')}</span>
                  <span className="block text-[12px] text-muted">{new Date(last.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </span>
                <RiskBadge level={displayLevel(last.result)} />
              </Press>
            </Reveal>
          )}

          <Reveal i={7} className="mt-6">
            <SectionTitle
              action={
                <button onClick={() => navigate('/app/profile')} className="text-[12.5px] font-bold text-teal-700">
                  {t('Edit')}
                </button>
              }
            >
              {t('Your profile at a glance')}
            </SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              {glance.map(({ Icon, label, value }) => (
                <div key={label} className="card flex items-center gap-3 p-3.5">
                  <Icon size={18} className="shrink-0 text-teal-600" />
                  <div className="min-w-0">
                    <div className="text-[11.5px] font-semibold text-muted">{t(label)}</div>
                    <div className="truncate text-[13.5px] font-bold text-navy-900">{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal i={8} className="mt-6">
            <Press onClick={() => navigate('/app/help')} className="flex w-full items-center justify-between rounded-2xl border border-dashed border-teal-200 bg-teal-50 p-4 text-left">
              <span>
                <span className="block text-[14px] font-bold text-navy-900">{t('Check a pack or report a side effect')}</span>
                <span className="block text-[12px] text-muted">{t('Links to mPedigree, the E-Pharmacy Platform and FDA Ghana')}</span>
              </span>
              <ChevronRight size={18} className="text-teal-700" />
            </Press>
          </Reveal>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
