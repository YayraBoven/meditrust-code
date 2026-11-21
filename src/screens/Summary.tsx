import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronRight, Copy, Eye, MessageCircle, MessageSquareText, QrCode, Store } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Logo, Press, Reveal, RiskBadge, StepHeader } from '../components/ui';
import { ingredientNames, medicineById } from '../data/medicines';
import { displayLevel } from '../engine/checks';
import { LEVEL_COPY, REFERRAL } from '../engine/explain';
import { SIGNPOSTS } from './Help';
import { useApp } from '../store/useApp';

/** Only what a pharmacist needs: the medicine, the flag and the reason. No name. */
function buildShareText(entryAt: string, level: keyof typeof LEVEL_COPY, meds: string[], reasons: string[], context: string[]) {
  return [
    'MediTrust medicine check (decision support only)',
    `Date: ${new Date(entryAt).toLocaleString()}`,
    `Medicine: ${meds.join(' + ')}`,
    `Result: ${LEVEL_COPY[level].label}`,
    ...reasons.map((r) => `- ${r}`),
    context.length ? `Relevant profile: ${context.join(', ')}` : '',
    REFERRAL.replace('before you take it', 'about this medicine'),
  ]
    .filter(Boolean)
    .join('\n');
}

export default function Summary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { history, profile } = useApp();
  const entry = history.find((h) => h.id === id);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!entry) {
    return (
      <div className="flex flex-1 flex-col">
        <StepHeader onBack={() => navigate('/app')} />
        <div className="p-6 text-muted">This summary is no longer on this phone.</div>
      </div>
    );
  }
  const r = entry.result;
  const meds = r.medicineIds.map(medicineById).filter(Boolean);
  const context = [
    profile.age ? `age ${profile.age}` : '',
    profile.pregnancy === 'pregnant' ? `pregnant${profile.trimester ? ` (trimester ${profile.trimester})` : ''}` : profile.pregnancy === 'breastfeeding' ? 'breastfeeding' : '',
    profile.g6pd === 'deficient' ? 'G6PD deficient' : ['family-history', 'not-sure', 'never-tested'].includes(profile.g6pd) ? 'G6PD status unknown' : '',
    ...profile.conditions,
  ].filter(Boolean);
  const text = buildShareText(
    entry.at,
    displayLevel(r),
    meds.map((m) => `${m!.brand} (${ingredientNames(m!).join(' + ')})`),
    r.flags.map((f) => f.message),
    context,
  );
  const enc = encodeURIComponent(text);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto">
      <StepHeader label="Summary" onBack={() => navigate(-1)} />
      <div className="px-5 pb-8">
        <Reveal>
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-navy-900">Show this to your pharmacist</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">Turn your phone around at the counter, or choose to share it. Nothing is sent unless you tap share.</p>
        </Reveal>

        <Reveal i={1} className="relative mt-5 overflow-hidden rounded-xl3 border border-line bg-card shadow-lift">
          <div className="flex items-center justify-between border-b border-dashed border-line bg-teal-50 px-5 py-4">
            <Logo size={28} />
            <div className="text-right text-[11px] font-semibold text-muted">
              Check summary
              <br />
              {new Date(entry.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Medicine</div>
              {meds.map((m) => (
                <div key={m!.id} className="mt-1">
                  <div className="text-[16px] font-extrabold text-navy-900">{m!.brand}</div>
                  <div className="text-[12.5px] text-muted">
                    {ingredientNames(m!).join(' + ')} · {[m!.strength, m!.prescriptionOnly === null ? 'Prescription status unknown' : m!.prescriptionOnly ? 'Prescription only' : 'Over the counter'].filter(Boolean).join(' · ')}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Result</div>
              <RiskBadge level={displayLevel(r)} size="lg" />
            </div>
            {r.flags.length > 0 ? (
              <ul className="space-y-2">
                {r.flags.map((f) => (
                  <li key={f.id} className="rounded-2xl bg-canvas p-3 text-[13px] leading-relaxed text-navy-900">
                    <span className="font-bold">{f.title}. </span>
                    {f.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">{displayLevel(r) === 'unverified' ? `No verified safety information yet for: ${r.unassessed.join(', ')}.` : 'No concern found in MediTrust’s three checks.'}</p>
            )}
            {context.length > 0 && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Relevant profile</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {context.map((c) => (
                    <span key={c} className="rounded-full bg-teal-100 px-2.5 py-1 text-[12px] font-semibold capitalize text-teal-800">
                      {c.replace('-', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-line p-3 text-[12px] leading-relaxed text-muted">
              <span className="font-bold text-navy-900">For the pharmacist: </span>
              MediTrust is decision support only. The flag comes from illustrative rules and the final decision is yours. Prescribed: {r.prescribed ? 'yes' : 'no or not sure'}.
            </div>
          </div>
        </Reveal>

        <Reveal i={2} className="mt-6">
          <h2 className="mb-3 text-[15px] font-bold text-navy-900">Share it yourself</h2>
          <Press onClick={() => setPreview((v) => !v)} className="mb-3 flex w-full items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 text-left">
            <span className="flex items-center gap-2 text-[13.5px] font-bold text-navy-900">
              <Eye size={16} className="text-teal-600" /> See exactly what will be shared
            </span>
            <motion.span animate={{ rotate: preview ? 90 : 0 }}>
              <ChevronRight size={16} className="text-muted" />
            </motion.span>
          </Press>
          <AnimatePresence>
            {preview && (
              <motion.pre initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-3 overflow-hidden whitespace-pre-wrap rounded-2xl bg-navy-900 p-4 font-sans text-[12px] leading-relaxed text-white/90">
                {text}
              </motion.pre>
            )}
          </AnimatePresence>
          <div className="grid grid-cols-3 gap-3">
            <a href={`https://wa.me/?text=${enc}`} target="_blank" rel="noreferrer" className="card flex flex-col items-center gap-2 py-4 text-[12.5px] font-bold text-navy-900 hover:border-teal-200">
              <MessageCircle size={22} className="text-[#1FA855]" /> WhatsApp
            </a>
            <a href={`sms:?&body=${enc}`} className="card flex flex-col items-center gap-2 py-4 text-[12.5px] font-bold text-navy-900 hover:border-teal-200">
              <MessageSquareText size={22} className="text-teal-600" /> SMS
            </a>
            <button onClick={copy} className="card flex flex-col items-center gap-2 py-4 text-[12.5px] font-bold text-navy-900 hover:border-teal-200">
              {copied ? <Check size={22} className="text-risk-low" /> : <Copy size={22} className="text-navy-700" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-center text-[11.5px] text-muted">
            <QrCode size={12} className="mr-1 inline" />
            Your first name is never included.
          </p>
        </Reveal>

        <Reveal i={3} className="mt-6">
          <h2 className="mb-3 text-[15px] font-bold text-navy-900">Other services that can help</h2>
          <div className="space-y-2.5">
            {SIGNPOSTS.slice(0, 3).map((s) => (
              <a key={s.name} href={s.url} target="_blank" rel="noreferrer" className="card flex items-center gap-3 p-4 hover:border-teal-200">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                  <s.Icon size={18} />
                </span>
                <span className="flex-1">
                  <span className="block text-[14px] font-bold text-navy-900">{s.action}</span>
                  <span className="block text-[12px] text-muted">{s.name} · separate service</span>
                </span>
                <ChevronRight size={16} className="text-muted" />
              </a>
            ))}
          </div>
        </Reveal>

        <Press onClick={() => navigate('/app')} className="btn-secondary mt-6">
          <Store size={16} /> Back to home
        </Press>
      </div>
    </div>
  );
}
