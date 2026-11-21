import { AnimatePresence, motion } from 'motion/react';
import { Check, Globe } from 'lucide-react';
import { useState } from 'react';
import { LANGS, coverage, langInfo, useT } from '../i18n';
import { useApp } from '../store/useApp';
import { Press } from './ui';

/** Compact language button that opens a bottom sheet with the five languages. */
export function LanguagePicker({ variant = 'chip' }: { variant?: 'chip' | 'row' }) {
  const { lang, setLang } = useApp();
  const [open, setOpen] = useState(false);
  const t = useT();
  const current = langInfo(lang);

  return (
    <>
      {variant === 'chip' ? (
        <Press onClick={() => setOpen(true)} aria-label={t('Choose language')} className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[13px] font-bold text-navy-900 shadow-card">
          <Globe size={16} className="text-teal-600" />
          {current.native}
        </Press>
      ) : (
        <Press onClick={() => setOpen(true)} className="flex w-full items-center justify-between rounded-2xl border border-line bg-card px-4 py-3.5 text-left">
          <span className="flex items-center gap-3">
            <Globe size={18} className="text-teal-600" />
            <span className="text-[14px] font-bold text-navy-900">{t('Language')}</span>
          </span>
          <span className="text-[14px] font-semibold text-muted">{current.native}</span>
        </Press>
      )}

      <AnimatePresence>
        {open && (
          <motion.div className="absolute inset-0 z-50 flex items-end bg-navy-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-t-[28px] bg-card p-6 pb-[max(env(safe-area-inset-bottom),24px)]"
              role="dialog"
              aria-label={t('Choose language')}
            >
              <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-line" />
              <h2 className="text-[18px] font-extrabold text-navy-900">{t('Choose language')}</h2>
              <p className="mb-4 mt-1 text-[12.5px] leading-relaxed text-muted">{t('Translations are machine-made with GhanaNLP and are being checked by fluent speakers.')}</p>
              <ul className="space-y-2">
                {LANGS.map((l) => (
                  <li key={l.id}>
                    <Press
                      onClick={() => {
                        setLang(l.id);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left ${lang === l.id ? 'border-teal-600 bg-teal-50' : 'border-line'}`}
                    >
                      <span>
                        <span className="block text-[15px] font-bold text-navy-900">{l.native}</span>
                        {l.native !== l.name && <span className="block text-[12px] text-muted">{l.name}</span>}
                        {coverage(l.id) < 1 && (
                          <span className="mt-1 block text-[11.5px] font-semibold text-note-ink">
                            {t('Translation in progress')} · {Math.round(coverage(l.id) * 100)}%
                          </span>
                        )}
                      </span>
                      {lang === l.id && <Check size={18} className="text-teal-700" strokeWidth={3} />}
                    </Press>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
