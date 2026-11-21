import { motion } from 'motion/react';
import { BatteryFull, History, Home, ScanSearch, Signal, UserRound, Wifi } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { DEMO_CASES } from '../data/demo';
import { useStartDemo } from '../lib/demo';
import { Logo } from './ui';
import { useT } from '../i18n';

const TABS = [
  { to: '/app', label: 'Home', Icon: Home, end: true },
  { to: '/app/check', label: 'Check', Icon: ScanSearch, end: false },
  { to: '/app/history', label: 'History', Icon: History, end: false },
  { to: '/app/profile', label: 'Profile', Icon: UserRound, end: false },
];

export function BottomNav() {
  const t = useT();
  return (
    <nav className="sticky bottom-0 z-30 border-t border-line bg-card/95 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-md">
      <ul className="flex justify-around">
        {TABS.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className="group flex w-16 flex-col items-center gap-1 py-1">
              {({ isActive }) => (
                <>
                  <span className="relative flex h-8 w-12 items-center justify-center">
                    {isActive && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-teal-100" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                    <Icon size={20} className={`relative ${isActive ? 'text-teal-700' : 'text-muted'}`} strokeWidth={isActive ? 2.4 : 2} />
                  </span>
                  <span className={`text-[11px] font-bold ${isActive ? 'text-teal-800' : 'text-muted'}`}>{t(label)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function useIsWide() {
  const q = '(min-width: 900px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

/**
 * On a phone the app fills the screen. On a laptop it sits in a phone frame,
 * with a side panel for presenting (demo profiles, what the prototype is).
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const wide = useIsWide();
  const navigate = useNavigate();
  const startDemo = useStartDemo();
  const t = useT();

  if (!wide) {
    return <div className="relative mx-auto flex h-[100dvh] max-w-[520px] flex-col overflow-hidden bg-canvas">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_10%_0%,#DDF2EF_0%,transparent_60%),radial-gradient(900px_500px_at_100%_100%,#E6ECF7_0%,transparent_55%)] bg-canvas">
      <div className="mx-auto grid min-h-screen max-w-[1180px] grid-cols-[1fr_auto] items-center gap-16 px-10 py-10">
        <div className="max-w-[460px]">
          <button onClick={() => navigate('/')} className="mb-10" aria-label="MediTrust home page">
            <Logo size={40} />
          </button>
          <div className="eyebrow mb-4">{t('High-fidelity prototype')}</div>
          <h1 className="text-[44px] font-extrabold leading-[1.05] tracking-tight text-navy-900">
            Check <em className="font-semibold not-italic text-teal-600 [font-style:italic]">before</em> you take it.
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-muted">
            {t('MediTrust compares a medicine with your own health profile, explains any risk in plain words, and sends you to a pharmacist or doctor. Try it in the phone, or open this page on your phone and add it to your home screen.')}
          </p>
          <div className="mt-8">
            <div className="mb-3 text-[13px] font-bold text-navy-900">{t('Run a demo patient')}</div>
            <div className="grid grid-cols-2 gap-3">
              {DEMO_CASES.map((d) => (
                <motion.button
                  key={d.id}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => startDemo(d.id)}
                  className="rounded-2xl border border-line bg-card p-3.5 text-left shadow-card transition-colors hover:border-teal-200"
                >
                  <div className="text-[14px] font-bold text-navy-900">{d.name}</div>
                  <div className="mt-0.5 text-[12px] leading-snug text-muted">{t(d.summary)}</div>
                </motion.button>
              ))}
            </div>
          </div>
          <p className="mt-8 text-[12px] leading-relaxed text-muted">
            {t('Decision support only. Medicine names, brands and rules in this prototype are illustrative and must be reviewed by a pharmacist.')}
          </p>
        </div>

        <div className="relative">
          <div className="relative h-[844px] w-[400px] rounded-[56px] border-[10px] border-navy-900 bg-navy-900 shadow-phone">
            <div className="absolute left-1/2 top-3 z-50 h-[30px] w-[110px] -translate-x-1/2 rounded-full bg-navy-900" />
            <div className="relative flex h-full flex-col overflow-hidden rounded-[46px] bg-canvas [transform:translateZ(0)]">
              <div className="flex h-11 shrink-0 items-center justify-between px-8 text-[13px] font-bold text-navy-900" aria-hidden="true">
                <span>9:41</span>
                <span className="flex items-center gap-1.5">
                  <Signal size={14} strokeWidth={2.6} />
                  <Wifi size={14} strokeWidth={2.6} />
                  <BatteryFull size={18} strokeWidth={2} />
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col [&_.sticky]:pt-2">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
