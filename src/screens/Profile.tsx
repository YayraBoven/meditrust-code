import { motion } from 'motion/react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav } from '../components/Shell';
import { Chip, Note, Press, Reveal } from '../components/ui';
import { medicineById } from '../data/medicines';
import type { AllergyGroup, Condition, G6pdStatus, Profile as P } from '../data/types';
import { searchMedicines } from '../engine/match';
import { useApp } from '../store/useApp';

const CONDITIONS: { id: Condition; label: string }[] = [
  { id: 'hypertension', label: 'Hypertension' },
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'asthma', label: 'Asthma' },
  { id: 'kidney', label: 'Kidney condition' },
  { id: 'stomach-ulcer', label: 'Stomach ulcer' },
  { id: 'sickle-cell', label: 'Sickle cell' },
  { id: 'liver', label: 'Liver condition' },
];

const ALLERGIES: { id: AllergyGroup; label: string }[] = [
  { id: 'penicillin', label: 'Penicillin' },
  { id: 'sulfa', label: 'Sulfa medicines' },
  { id: 'nsaid', label: 'Aspirin or ibuprofen' },
];

const G6PD: { id: G6pdStatus; label: string; hint: string }[] = [
  { id: 'normal', label: 'Tested: normal', hint: 'A test showed I do not have it' },
  { id: 'deficient', label: 'Tested: G6PD deficient', hint: 'A test showed I have it' },
  { id: 'family-history', label: 'A relative has it', hint: 'Not tested myself' },
  { id: 'not-sure', label: 'I am not sure', hint: '' },
  { id: 'never-tested', label: 'Never tested', hint: '' },
];

function Section({ n, title, sub, children }: { n: number; title: string; sub?: string; children: ReactNode }) {
  return (
    <Reveal i={n} className="card p-5">
      <div className="mb-4 flex gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[13px] font-bold text-white">{n}</span>
        <div>
          <h2 className="text-[16px] font-bold text-navy-900">{title}</h2>
          {sub && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{sub}</p>}
        </div>
      </div>
      {children}
    </Reveal>
  );
}

function MedicinePicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState('');
  const results = searchMedicines(q, 5).filter((r) => !value.includes(r.medicine.id));
  return (
    <div>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a medicine you take" className="field pl-10" aria-label="Search a medicine you take" />
      </div>
      {q.length >= 2 && (
        <motion.ul initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 overflow-hidden rounded-2xl border border-line bg-card">
          {results.length ? (
            results.map(({ medicine: m }) => (
              <li key={m.id}>
                <button
                  onClick={() => {
                    onChange([...value, m.id]);
                    setQ('');
                  }}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-teal-50"
                >
                  <span>
                    <span className="block text-[14px] font-bold text-navy-900">{m.brand}</span>
                    <span className="block text-[12px] text-muted">{m.generic}</span>
                  </span>
                  <Plus size={18} className="text-teal-600" />
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-[13px] text-muted">Not in our demo list yet. Tell your pharmacist about it.</li>
          )}
        </motion.ul>
      )}
      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((id) => {
            const m = medicineById(id);
            if (!m) return null;
            return (
              <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 py-1.5 pl-3 pr-1.5 text-[13px] font-semibold text-teal-800">
                {m.brand}
                <button aria-label={`Remove ${m.brand}`} onClick={() => onChange(value.filter((v) => v !== id))} className="rounded-full p-0.5 hover:bg-teal-100">
                  <X size={14} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setup = params.get('setup') === '1';
  const { profile, setProfile, resetAll, demoId } = useApp();
  const [p, setP] = useState<P>(profile);
  const [saved, setSaved] = useState(false);
  const up = (patch: Partial<P>) => {
    setP((cur) => ({ ...cur, ...patch }));
    setSaved(false);
  };
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = () => {
    setProfile({ ...p, trimester: p.pregnancy === 'pregnant' ? p.trimester : null });
    setSaved(true);
    if (setup) navigate('/app', { replace: true });
  };

  return (
    <>
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="px-5 pb-6 pt-[max(env(safe-area-inset-top),22px)]">
          <Reveal>
            <div className="eyebrow">{setup ? 'Step 1 · About you' : 'Your profile'}</div>
            <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-navy-900">Build your health profile</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">Tell us a little about your health. Every check uses this. You can update it later.</p>
          </Reveal>

          {demoId && (
            <div className="mt-4">
              <Note title="Demo patient loaded">This is a demo profile for presenting. Edit it freely or delete it below.</Note>
            </div>
          )}

          <div className="mt-5 space-y-4">
            <Section n={1} title="About you">
              <div className="grid grid-cols-[1fr_96px] gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-bold text-navy-900">First name <span className="font-medium text-muted">(optional)</span></span>
                  <input className="field" value={p.name} onChange={(e) => up({ name: e.target.value })} placeholder="e.g. Ama" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-bold text-navy-900">Age</span>
                  <input className="field" inputMode="numeric" value={p.age ?? ''} onChange={(e) => up({ age: e.target.value ? Math.min(120, Number(e.target.value.replace(/\D/g, ''))) : null })} placeholder="42" />
                </label>
              </div>
            </Section>

            <Section n={2} title="Known allergies">
              <div className="grid grid-cols-3 gap-2">
                {(['none', 'some', 'not-sure'] as const).map((a) => (
                  <Chip key={a} on={p.allergyAnswer === a} onClick={() => up({ allergyAnswer: a, ...(a !== 'some' ? { allergies: [], otherAllergies: '' } : {}) })}>
                    {a === 'none' ? 'None' : a === 'some' ? 'Yes' : 'Not sure'}
                  </Chip>
                ))}
              </div>
              {p.allergyAnswer === 'some' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ALLERGIES.map((a) => (
                      <Chip key={a.id} on={p.allergies.includes(a.id)} onClick={() => up({ allergies: toggle(p.allergies, a.id) })}>
                        {a.label}
                      </Chip>
                    ))}
                  </div>
                  <input className="field mt-3" value={p.otherAllergies} onChange={(e) => up({ otherAllergies: e.target.value })} placeholder="Or type another allergy" />
                </motion.div>
              )}
            </Section>

            <Section n={3} title="Medicines you take now" sub="Used to spot the same ingredient twice.">
              <MedicinePicker value={p.currentMedicines} onChange={(currentMedicines) => up({ currentMedicines })} />
            </Section>

            <Section n={4} title="Health conditions">
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map((c) => (
                  <Chip key={c.id} on={p.conditions.includes(c.id)} onClick={() => up({ conditions: toggle(p.conditions, c.id) })}>
                    {c.label}
                  </Chip>
                ))}
              </div>
            </Section>

            <Section n={5} title="Pregnancy" sub="Some medicines are not right at certain stages of pregnancy.">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['not-applicable', 'Does not apply'],
                    ['not-pregnant', 'Not pregnant'],
                    ['pregnant', 'Pregnant'],
                    ['breastfeeding', 'Breastfeeding'],
                  ] as const
                ).map(([id, label]) => (
                  <Chip key={id} on={p.pregnancy === id} onClick={() => up({ pregnancy: id })}>
                    {label}
                  </Chip>
                ))}
              </div>
              {p.pregnancy === 'pregnant' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                  <div className="mb-2 mt-4 text-[13px] font-bold text-navy-900">Which trimester?</div>
                  <div className="grid grid-cols-3 gap-2">
                    {([1, 2, 3] as const).map((t) => (
                      <Press
                        key={t}
                        onClick={() => up({ trimester: t })}
                        className={`rounded-2xl border px-2 py-3 text-center ${p.trimester === t ? 'border-teal-600 bg-teal-100 text-teal-800' : 'border-line bg-card text-navy-900'}`}
                      >
                        <div className="text-[15px] font-extrabold">{t === 1 ? '1st' : t === 2 ? '2nd' : '3rd'}</div>
                        <div className="text-[11px] font-semibold opacity-80">{t === 1 ? 'Weeks 1–12' : t === 2 ? 'Weeks 13–27' : 'Week 28+'}</div>
                      </Press>
                    ))}
                  </div>
                  <button onClick={() => up({ trimester: null })} className={`mt-2 text-[12.5px] font-bold ${p.trimester === null ? 'text-teal-700' : 'text-muted'}`}>
                    {p.trimester === null ? '✓ ' : ''}I am not sure
                  </button>
                </motion.div>
              )}
            </Section>

            <Section n={6} title="G6PD status" sub="G6PD deficiency is common in Ghana and many people do not know they have it.">
              <div className="space-y-2">
                {G6PD.map((g) => (
                  <Press
                    key={g.id}
                    onClick={() => up({ g6pd: g.id })}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${p.g6pd === g.id ? 'border-teal-600 bg-teal-50' : 'border-line bg-card'}`}
                  >
                    <span>
                      <span className="block text-[14px] font-bold text-navy-900">{g.label}</span>
                      {g.hint && <span className="block text-[12px] text-muted">{g.hint}</span>}
                    </span>
                    <span className={`h-5 w-5 rounded-full border-2 ${p.g6pd === g.id ? 'border-teal-600 bg-teal-600 shadow-[inset_0_0_0_3px_white]' : 'border-line'}`} />
                  </Press>
                ))}
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">A relative having it, or not knowing, is treated as a question to ask a pharmacist. It does not mean you have it.</p>
            </Section>
          </div>

          <div className="mt-6 space-y-3">
            <Press onClick={save} className="btn-primary">
              {setup ? 'Save and continue' : saved ? 'Saved ✓' : 'Save profile'}
            </Press>
            {!setup && (
              <button
                onClick={() => {
                  if (window.confirm('Delete your profile and history from this phone?')) {
                    resetAll();
                    navigate('/app/welcome', { replace: true });
                  }
                }}
                className="flex w-full items-center justify-center gap-2 py-2 text-[13px] font-bold text-risk-high"
              >
                <Trash2 size={15} /> Delete my profile from this phone
              </button>
            )}
          </div>
        </div>
      </div>
      {!setup && <BottomNav />}
    </>
  );
}
