import { AnimatePresence, motion } from 'motion/react';
import { Check as CheckIcon, ChevronDown, Plus, Trash2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Person } from '../store/useApp';
import { useApp } from '../store/useApp';
import { ConfirmSheet, Press } from './ui';
import { useT } from '../i18n';

/** Short facts about a person, shown under their name. */
function facts(p: Person, t: (s: string) => string): string {
  const f = p.profile;
  return [
    f.age ? String(f.age) : '',
    f.pregnancy === 'pregnant' ? t('Pregnant') : f.pregnancy === 'breastfeeding' ? t('Breastfeeding') : '',
    f.g6pd === 'deficient' ? 'G6PD' : '',
    f.conditions.length ? `${f.conditions.length} ${t(f.conditions.length === 1 ? 'condition' : 'conditions')}` : '',
    f.allergies.length || f.otherAllergies.trim() ? t('allergies') : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

const label = (p: Person, t: (s: string) => string) => p.profile.name.trim() || t('Unnamed person');

/**
 * "Checking for: Abena ▾". Several people (yourself, a child, a parent) can be kept
 * on one phone, each with their own profile and past checks. Nothing leaves the phone.
 */
export function PersonSwitcher({ dark = false }: { dark?: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const { people, activeId, switchPerson, addPerson, removePerson } = useApp();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<Person | null>(null);
  const active = people.find((p) => p.id === activeId);
  if (!active) return null;

  const add = () => {
    setOpen(false);
    addPerson();
    navigate('/app/profile?setup=1');
  };

  return (
    <>
      <Press
        onClick={() => setOpen(true)}
        aria-label={t('Choose who this check is for')}
        className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-bold shadow-card ${dark ? 'border-white/20 bg-white/10 text-white' : 'border-line bg-card text-navy-900'}`}
      >
        <UserRound size={15} className={dark ? 'text-teal-200' : 'text-teal-600'} />
        <span className={dark ? 'text-white/70' : 'text-muted'}>{t('Checking for:')}</span>
        <span className="truncate">{label(active, t)}</span>
        {active.demoId && <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-teal-800">{t('Demo')}</span>}
        <ChevronDown size={15} />
      </Press>

      <AnimatePresence>
        {open && (
          <motion.div className="absolute inset-0 z-50 flex items-end bg-navy-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[80%] w-full overflow-y-auto rounded-t-[28px] bg-card p-6 pb-[max(env(safe-area-inset-bottom),24px)]"
              role="dialog"
              aria-label={t('Who is this check for?')}
            >
              <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-line" />
              <h2 className="text-[18px] font-extrabold text-navy-900">{t('Who is this check for?')}</h2>
              <p className="mb-4 mt-1 text-[13px] text-muted">{t('Each person has their own health profile and past checks. Everything stays on this phone.')}</p>
              <div className="space-y-2">
                {people.map((p) => (
                  <div key={p.id} className={`flex items-center gap-2 rounded-2xl border p-1 ${p.id === activeId ? 'border-teal-600 bg-teal-50' : 'border-line bg-card'}`}>
                    <Press
                      onClick={() => {
                        switchPerson(p.id);
                        setOpen(false);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2.5 text-left"
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold ${p.id === activeId ? 'bg-teal-600 text-white' : 'bg-teal-100 text-teal-800'}`}>
                        {label(p, t).charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[15px] font-bold text-navy-900">{label(p, t)}</span>
                          {p.demoId && <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-teal-800">{t('Demo')}</span>}
                        </span>
                        <span className="block truncate text-[12px] text-muted">{facts(p, t) || t('No details yet')}</span>
                      </span>
                      {p.id === activeId && <CheckIcon size={18} strokeWidth={3} className="shrink-0 text-teal-600" />}
                    </Press>
                    <button onClick={() => setRemoving(p)} aria-label={`${t('Remove')} ${label(p, t)}`} className="rounded-xl p-2.5 text-muted hover:text-risk-high">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <Press onClick={add} className="btn-secondary mt-4">
                <Plus size={17} /> {t('Add a person')}
              </Press>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmSheet
        open={!!removing}
        title="Remove this person from this phone?"
        body="Their health profile and past checks will be deleted. This cannot be undone."
        confirmLabel="Remove"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const wasLast = people.length === 1;
          if (removing) removePerson(removing.id);
          setRemoving(null);
          setOpen(false);
          if (wasLast) navigate('/app/welcome', { replace: true });
        }}
      />
    </>
  );
}
