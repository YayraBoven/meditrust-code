import { motion, type HTMLMotionProps } from 'motion/react';
import { AlertTriangle, ArrowLeft, Check, HelpCircle, Info, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DisplayLevel } from '../data/types';
import { LEVEL_COPY } from '../engine/explain';
import { useT } from '../i18n';

export function Logo({ size = 36, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
        <rect width="512" height="512" rx="128" fill="#0E9384" />
        <path d="M256 96 384 144v96c0 84-54 150-128 176-74-26-128-92-128-176v-96z" fill="#fff" />
        <path d="M232 184h48v48h48v48h-48v48h-48v-48h-48v-48h48z" fill="#0E9384" />
      </svg>
      {withText && (
        <div className="leading-none">
          <div className="text-[17px] font-extrabold tracking-tight text-navy-900">MediTrust</div>
          <div className="mt-0.5 text-[9px] font-bold tracking-[0.32em] text-teal-700">GHANA</div>
        </div>
      )}
    </div>
  );
}

/** Fade-and-rise entrance, staggered by `i`. */
export function Reveal({ i = 0, children, className, ...rest }: { i?: number; children: ReactNode; className?: string } & HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function Press({ children, className, ...rest }: HTMLMotionProps<'button'>) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className={className} {...rest}>
      {children}
    </motion.button>
  );
}

export function StepHeader({ step, total = 5, onBack, label }: { step?: number; total?: number; onBack?: () => void; label?: string }) {
  const navigate = useNavigate();
  const t = useT();
  return (
    <div className="sticky top-0 z-20 bg-canvas/85 pb-3 pt-[max(env(safe-area-inset-top),14px)] backdrop-blur-md">
      <div className="flex items-center justify-between px-5">
        <Press
          aria-label={t('Go back')}
          onClick={onBack ?? (() => navigate(-1))}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-navy-900 shadow-card"
        >
          <ArrowLeft size={18} />
        </Press>
        {label && <div className="text-[13px] font-bold text-navy-900">{t(label)}</div>}
        {step ? <div className="text-[12px] font-bold text-muted">{step} / {total}</div> : <div className="w-10" />}
      </div>
      {step && (
        <div className="mt-3 flex gap-1.5 px-5" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-teal-100">
              <motion.div
                className="h-full rounded-full bg-teal-600"
                initial={{ width: i < step - 1 ? '100%' : '0%' }}
                animate={{ width: i < step ? '100%' : '0%' }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const RISK_STYLE: Record<DisplayLevel, { wrap: string; dot: string; Icon: typeof ShieldAlert }> = {
  high: { wrap: 'bg-risk-highBg text-risk-high border-risk-highLine', dot: 'bg-risk-high', Icon: ShieldAlert },
  medium: { wrap: 'bg-risk-mediumBg text-risk-medium border-risk-mediumLine', dot: 'bg-risk-mediumDot', Icon: AlertTriangle },
  low: { wrap: 'bg-risk-lowBg text-risk-low border-risk-lowLine', dot: 'bg-risk-low', Icon: ShieldCheck },
  unverified: { wrap: 'bg-[#EEF1F7] text-navy-700 border-[#D5DBE8]', dot: 'bg-navy-700', Icon: HelpCircle },
};

export function RiskBadge({ level, size = 'sm' }: { level: DisplayLevel; size?: 'sm' | 'lg' }) {
  const t = useT();
  const s = RISK_STYLE[level];
  const Icon = s.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-bold ${s.wrap} ${size === 'lg' ? 'px-3.5 py-1.5 text-[13px]' : 'px-2.5 py-1 text-[11.5px]'}`}>
      <Icon size={size === 'lg' ? 15 : 13} strokeWidth={2.4} />
      {t(LEVEL_COPY[level].label)}
    </span>
  );
}

export const riskStyle = RISK_STYLE;

export function Note({ title = 'Illustrative information', children }: { title?: string; children: ReactNode }) {
  const t = useT();
  return (
    <div className="flex gap-3 rounded-2xl border border-note-line/60 bg-note-bg p-3.5">
      <Info size={16} className="mt-0.5 shrink-0 text-note-ink" />
      <div className="text-[12.5px] leading-relaxed text-note-ink">
        <div className="font-bold">{t(title)}</div>
        <div className="opacity-90">{typeof children === 'string' ? t(children) : children}</div>
      </div>
    </div>
  );
}

export function Chip({ on, children, onClick }: { on: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <Press
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
        on ? 'border-teal-600 bg-teal-100 text-teal-800' : 'border-line bg-card text-navy-900 hover:border-teal-200'
      }`}
    >
      {on && <Check size={14} strokeWidth={3} />}
      {children}
    </Press>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const t = useT();
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[15px] font-bold text-navy-900">{typeof children === 'string' ? t(children) : children}</h2>
      {action}
    </div>
  );
}

export function Disclaimer() {
  const t = useT();
  return (
    <p className="px-1 text-center text-[11.5px] leading-relaxed text-muted">
      {t('MediTrust gives decision support only. It does not diagnose, prescribe or replace a pharmacist or doctor.')}
    </p>
  );
}
