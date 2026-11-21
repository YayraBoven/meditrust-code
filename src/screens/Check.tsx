import { AnimatePresence, motion } from 'motion/react';
import { Camera, Check as CheckIcon, ChevronRight, Keyboard, Mic, Pill, Plus, Search, Stethoscope, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Note, Press, Reveal, StepHeader } from '../components/ui';
import { INGREDIENTS, ingredientNames, medicineById } from '../data/medicines';
import type { Medicine } from '../data/types';
import { CHECK_LABELS, runChecks } from '../engine/checks';
import { CONFIDENT, searchMedicines } from '../engine/match';
import { useApp } from '../store/useApp';

/* ------------------------------------------------------------------ */
/* Step 1 · Enter a medicine                                           */
/* ------------------------------------------------------------------ */

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: { 0: { transcript: string } }[] }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};

function getSpeech(): SpeechCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function CheckInput() {
  const navigate = useNavigate();
  const { draft, setDraft } = useApp();
  const [q, setQ] = useState(draft.query);
  const [mode, setMode] = useState<'type' | 'photo' | 'voice'>('type');
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchMedicines(q), [q]);
  const Speech = typeof window !== 'undefined' ? getSpeech() : null;
  const added = draft.medicineIds.map(medicineById).filter((m): m is Medicine => !!m);

  useEffect(() => {
    if (mode === 'type') inputRef.current?.focus({ preventScroll: true });
  }, [mode]);

  const pick = (id: string) => {
    setDraft({ pendingId: id, query: q });
    navigate('/app/check/confirm');
  };

  const submit = () => {
    if (results[0] && results[0].score >= CONFIDENT) pick(results[0].medicine.id);
    else if (q.trim().length >= 2) {
      setDraft({ query: q });
      navigate('/app/check/no-match');
    }
  };

  const listen = () => {
    if (!Speech) return;
    const r = new Speech();
    r.lang = 'en-GB';
    r.interimResults = false;
    r.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setQ(text);
      setMode('type');
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  };

  return (
    <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto">
      <StepHeader step={1} onBack={() => navigate('/app')} />
      <div className="flex flex-1 flex-col px-5 pb-6">
        <Reveal>
          <div className="eyebrow">Step 1 · Your medicine</div>
          <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-navy-900">Which medicine would you like to check?</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">Type the name on the pack. A brand name or the medicine inside both work.</p>
        </Reveal>

        <Reveal i={1} className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-teal-100/60 p-1">
          {(
            [
              ['type', 'Type', Keyboard],
              ['photo', 'Scan pack', Camera],
              ['voice', 'Speak', Mic],
            ] as const
          ).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setMode(id)} className="relative flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold">
              {mode === id && <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-xl bg-card shadow-card" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <Icon size={15} className={`relative ${mode === id ? 'text-teal-700' : 'text-muted'}`} />
              <span className={`relative ${mode === id ? 'text-navy-900' : 'text-muted'}`}>{label}</span>
            </button>
          ))}
        </Reveal>

        <AnimatePresence mode="wait">
          {mode === 'type' && (
            <motion.div key="type" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
                className="relative"
              >
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-teal-600" />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="e.g. ibuprofen, Paracare, cold and flu"
                  className="field py-4 pl-11 pr-11 text-[16px]"
                  aria-label="Medicine name"
                  autoComplete="off"
                  enterKeyHint="search"
                />
                {q && (
                  <button type="button" aria-label="Clear" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted hover:bg-canvas">
                    <X size={16} />
                  </button>
                )}
              </form>

              <ul className="mt-3 space-y-2">
                <AnimatePresence initial={false}>
                  {results.map(({ medicine: m }, k) => (
                    <motion.li key={m.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: k * 0.03 } }} exit={{ opacity: 0 }}>
                      <Press onClick={() => pick(m.id)} className="card flex w-full items-center gap-3 p-3.5 text-left hover:border-teal-200">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                          <Pill size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px] font-bold text-navy-900">{m.brand}</span>
                          <span className="block truncate text-[12.5px] text-muted">
                            {ingredientNames(m).join(' + ')} · {m.strength}
                          </span>
                        </span>
                        <ChevronRight size={18} className="text-muted" />
                      </Press>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              {q.trim().length >= 2 && results.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
                  <Press onClick={submit} className="btn-secondary">
                    Search for “{q.trim()}”
                  </Press>
                </motion.div>
              )}
              {!q && (
                <div className="mt-4">
                  <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-muted">Try</div>
                  <div className="flex flex-wrap gap-2">
                    {['ibuprofen', 'doxycycline', 'primaquine', 'ColdAway', 'amoxicillin'].map((s) => (
                      <button key={s} onClick={() => setQ(s)} className="rounded-full border border-line bg-card px-3 py-1.5 text-[12.5px] font-semibold text-navy-900 hover:border-teal-200">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {mode === 'photo' && (
            <motion.div key="photo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-4">
              <div className="relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-xl3 bg-navy-900 text-center text-white">
                <div className="absolute inset-6 rounded-2xl border-2 border-dashed border-white/30" />
                <motion.div className="absolute left-6 right-6 h-0.5 bg-teal-500 shadow-[0_0_16px_#14A594]" animate={{ top: ['20%', '80%', '20%'] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
                <Camera size={34} className="relative opacity-80" />
                <div className="relative mt-3 text-[15px] font-bold">Pack scanning is coming next</div>
                <div className="relative mt-1 max-w-[240px] text-[12.5px] text-white/70">In this prototype, please type the name printed on the pack.</div>
              </div>
              <Press onClick={() => setMode('type')} className="btn-secondary mt-4">
                Type the name instead
              </Press>
            </motion.div>
          )}

          {mode === 'voice' && (
            <motion.div key="voice" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-6 flex flex-col items-center text-center">
              <Press onClick={listen} disabled={!Speech || listening} aria-label="Start speaking" className="relative flex h-28 w-28 items-center justify-center rounded-full bg-teal-600 text-white shadow-[0_18px_40px_rgba(14,147,132,0.35)] disabled:opacity-60">
                {listening && <motion.span className="absolute inset-0 rounded-full bg-teal-500" animate={{ scale: [1, 1.5], opacity: [0.5, 0] }} transition={{ duration: 1.2, repeat: Infinity }} />}
                <Mic size={40} className="relative" />
              </Press>
              <div className="mt-5 text-[15px] font-bold text-navy-900">{listening ? 'Listening…' : Speech ? 'Tap and say the medicine name' : 'Voice input is not available on this browser'}</div>
              <div className="mt-1 max-w-[260px] text-[12.5px] text-muted">English for now. Twi, Ewe, Ga and Dagbani are planned for a later version.</div>
            </motion.div>
          )}
        </AnimatePresence>

        {added.length > 0 && (
          <div className="mt-auto pt-6">
            <div className="mb-2 text-[12.5px] font-bold text-navy-900">Checking together</div>
            <div className="mb-3 flex flex-wrap gap-2">
              {added.map((m) => (
                <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1.5 text-[13px] font-semibold text-teal-800">
                  <CheckIcon size={13} strokeWidth={3} /> {m.brand}
                </span>
              ))}
            </div>
            <Press onClick={() => navigate('/app/check/prescribed')} className="btn-primary">
              Continue with {added.length} medicine{added.length > 1 ? 's' : ''}
            </Press>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 · Confirm                                                    */
/* ------------------------------------------------------------------ */

function PackArt({ m }: { m: Medicine }) {
  return (
    <motion.div
      initial={{ rotateX: 18, y: 16, opacity: 0 }}
      animate={{ rotateX: 0, y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-xl3 border border-line bg-card p-5 shadow-lift [transform-style:preserve-3d]"
    >
      <div className="absolute inset-y-0 left-0 w-24 -skew-x-12 bg-teal-600" style={{ left: -28 }} />
      <div className="absolute inset-y-0 w-6 -skew-x-12 bg-navy-900" style={{ left: 66 }} />
      <div className="relative ml-24">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-note-ink">Demo sample</div>
        <div className="mt-1 text-[24px] font-extrabold leading-tight tracking-tight text-teal-700">{m.brand}</div>
        <div className="mt-1 text-[12.5px] font-semibold text-navy-900">
          {m.strength} · {m.form}
        </div>
        <div className="mt-4 text-[10.5px] text-muted">For prototype use only</div>
      </div>
      <motion.div
        className="absolute bottom-4 right-5 h-5 w-12 rounded-full bg-gradient-to-r from-teal-500 from-50% to-white to-50% shadow"
        animate={{ rotate: [-12, -4, -12] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}

export function Confirm() {
  const navigate = useNavigate();
  const { draft, setDraft } = useApp();
  const m = draft.pendingId ? medicineById(draft.pendingId) : undefined;
  if (!m) {
    return (
      <div className="flex flex-1 flex-col">
        <StepHeader step={2} />
        <div className="p-6 text-muted">Nothing to confirm yet.</div>
      </div>
    );
  }
  const yes = () => {
    setDraft({ medicineIds: draft.medicineIds.includes(m.id) ? draft.medicineIds : [...draft.medicineIds, m.id], pendingId: null });
    navigate('/app/check/prescribed');
  };
  return (
    <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto">
      <StepHeader step={2} />
      <div className="px-5 pb-6">
        <Reveal>
          <div className="eyebrow">Please review</div>
          <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-navy-900">Confirm your medicine</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">We found a possible match. Please check these details before continuing.</p>
        </Reveal>
        <div className="mt-5 [perspective:900px]">
          <PackArt m={m} />
        </div>
        <Reveal i={2} className="card mt-4 p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Possible match</div>
              <div className="mt-1 text-[19px] font-extrabold text-navy-900">{m.generic}</div>
            </div>
            <Pill size={20} className="text-teal-600" />
          </div>
          <div className="my-4 h-px bg-line" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              ['Brand', m.brand],
              ['Active ingredient', ingredientNames(m).join(' + ')],
              ['Strength', m.strength],
              ['Form', m.form],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[12px] text-muted">{k}</dt>
                <dd className="text-[14px] font-bold text-navy-900">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-center gap-2 text-[12.5px] text-muted">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${m.prescriptionOnly ? 'bg-navy-900 text-white' : 'bg-teal-100 text-teal-800'}`}>{m.prescriptionOnly ? 'Prescription only' : 'Over the counter'}</span>
            {INGREDIENTS[m.ingredients[0]]?.kind}
          </div>
        </Reveal>
        <Reveal i={3} className="mt-4">
          <Note>This match is for demonstration only. It comes from MediTrust’s illustrative medicine list, not a verified live database.</Note>
        </Reveal>
        <Reveal i={4} className="mt-6 space-y-3">
          <div className="text-center text-[15px] font-semibold text-navy-900">Is this the correct medicine?</div>
          <Press onClick={yes} className="btn-primary">
            <CheckIcon size={18} strokeWidth={3} /> Yes, this is my medicine
          </Press>
          <Press onClick={() => navigate('/app/check')} className="btn-secondary">
            No, try again
          </Press>
          <button onClick={() => navigate('/app/check/no-match')} className="w-full py-1 text-[13px] font-semibold text-muted underline underline-offset-4">
            I cannot confirm the medicine
          </button>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* No match (step 3b)                                                  */
/* ------------------------------------------------------------------ */

export function NoMatch() {
  const navigate = useNavigate();
  const { draft } = useApp();
  return (
    <div className="flex flex-1 flex-col">
      <StepHeader />
      <div className="flex flex-1 flex-col px-6 pb-8">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 16 }} className="flex h-24 w-24 items-center justify-center rounded-[30px] bg-risk-mediumBg text-risk-medium">
            <Stethoscope size={42} />
          </motion.div>
          <Reveal i={1}>
            <h1 className="mt-6 text-[26px] font-extrabold leading-tight tracking-tight text-navy-900">We could not confirm this medicine</h1>
            <p className="mx-auto mt-3 max-w-[300px] text-[14.5px] leading-relaxed text-muted">
              {draft.query ? <>“{draft.query}” is not in our list. </> : null}For your safety, we cannot complete the check. Please show the medicine to a pharmacist.
            </p>
          </Reveal>
          <Reveal i={2} className="mt-4 rounded-2xl bg-card px-4 py-3 text-[12.5px] text-muted shadow-card">
            No safety check was run. MediTrust never guesses.
          </Reveal>
        </div>
        <div className="space-y-3">
          <Press onClick={() => navigate('/app/check')} className="btn-primary">
            Try a different name
          </Press>
          <Press onClick={() => navigate('/app/help')} className="btn-secondary">
            Find a licensed pharmacy
          </Press>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 · Prescribed?                                                */
/* ------------------------------------------------------------------ */

export function Prescribed() {
  const navigate = useNavigate();
  const { draft, setDraft } = useApp();
  const meds = draft.medicineIds.map(medicineById).filter((m): m is Medicine => !!m);
  const [choice, setChoice] = useState<boolean | 'unsure' | null>(draft.prescribed);

  const go = () => {
    // "Not sure" is treated like "No": the safer reading for the self-medication check.
    setDraft({ prescribed: choice === true });
    navigate('/app/check/running');
  };

  return (
    <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto">
      <StepHeader step={3} />
      <div className="flex flex-1 flex-col px-5 pb-6">
        <Reveal>
          <div className="eyebrow">Step 3 · Where it came from</div>
          <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-navy-900">Was this prescribed for you?</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">Many people buy medicines without a prescription. That is common, and it is exactly when a quick check helps.</p>
        </Reveal>

        <Reveal i={1} className="mt-5 flex flex-wrap gap-2">
          {meds.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-[13px] font-semibold text-teal-800">
              <Pill size={13} /> {m.brand}
            </span>
          ))}
          <button onClick={() => navigate('/app/check')} className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1.5 text-[13px] font-semibold text-muted hover:border-teal-200 hover:text-teal-700">
            <Plus size={14} /> Add another to check together
          </button>
        </Reveal>

        <div className="mt-5 space-y-3">
          {(
            [
              [true, 'Yes, a doctor prescribed it', 'From a hospital, clinic or doctor'],
              [false, 'No, I bought it myself', 'From a pharmacy, chemical shop or market'],
              ['unsure', 'I am not sure', 'We will treat it as not prescribed, to be safe'],
            ] as const
          ).map(([val, title, sub], k) => (
            <Reveal key={String(val)} i={2 + k}>
              <Press
                onClick={() => setChoice(val)}
                className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${choice === val ? 'border-teal-600 bg-teal-50 shadow-card' : 'border-line bg-card'}`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${choice === val ? 'border-teal-600 bg-teal-600 text-white' : 'border-line'}`}>
                  {choice === val && <CheckIcon size={14} strokeWidth={3} />}
                </span>
                <span>
                  <span className="block text-[15px] font-bold text-navy-900">{title}</span>
                  <span className="block text-[12.5px] text-muted">{sub}</span>
                </span>
              </Press>
            </Reveal>
          ))}
        </div>

        <div className="mt-auto pt-6">
          <Press disabled={choice === null} onClick={go} className="btn-primary">
            Run the safety checks
          </Press>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 · Checks running                                             */
/* ------------------------------------------------------------------ */

export function Running() {
  const navigate = useNavigate();
  const { draft, profile, addHistory, resetDraft } = useApp();
  const [done, setDone] = useState(0);
  const result = useMemo(() => runChecks(profile, draft.medicineIds, draft.prescribed), []); // eslint-disable-line react-hooks/exhaustive-deps
  const saved = useRef<string | null>(null);

  useEffect(() => {
    if (!draft.medicineIds.length) {
      navigate('/app/check', { replace: true });
      return;
    }
    const timers = [600, 1250, 1900].map((t, k) => setTimeout(() => setDone(k + 1), t));
    const end = setTimeout(() => {
      if (!saved.current) saved.current = addHistory(result);
      resetDraft();
      navigate(`/app/result/${saved.current}`, { replace: true });
    }, 2600);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(end);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader step={4} />
      <div className="flex flex-1 flex-col items-center px-6 pt-6">
        <div className="relative flex h-44 w-44 items-center justify-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#DDF2EF" strokeWidth="7" />
            <motion.circle cx="50" cy="50" r="44" fill="none" stroke="#0E9384" strokeWidth="7" strokeLinecap="round" strokeDasharray="276.5" initial={{ strokeDashoffset: 276.5 }} animate={{ strokeDashoffset: 276.5 * (1 - done / 3) }} transition={{ duration: 0.6, ease: 'easeOut' }} />
          </svg>
          <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.2, repeat: Infinity }} className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-teal-600 text-white shadow-[0_14px_30px_rgba(14,147,132,0.35)]">
            <Search size={38} />
          </motion.div>
        </div>
        <h1 className="mt-8 text-center text-[24px] font-extrabold tracking-tight text-navy-900">Running your three checks</h1>
        <p className="mt-2 text-center text-[14px] text-muted">Comparing the medicine with your health profile using clear safety rules.</p>
        <ul className="mt-8 w-full space-y-3">
          {result.checksRun.map((c, k) => (
            <motion.li key={c.kind} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + k * 0.12 }} className="card flex items-center gap-3 p-4">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${done > k ? 'bg-teal-600 text-white' : 'bg-teal-100 text-teal-700'}`}>
                {done > k ? (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}>
                    <CheckIcon size={16} strokeWidth={3} />
                  </motion.span>
                ) : (
                  <motion.span className="h-3 w-3 rounded-full border-2 border-teal-600 border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                )}
              </span>
              <span className="flex-1 text-[14.5px] font-bold text-navy-900">{CHECK_LABELS[c.kind]}</span>
              <span className="text-[12px] font-semibold text-muted">{done > k ? 'Done' : 'Checking'}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
