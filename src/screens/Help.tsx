import { BadgeCheck, BookOpen, ChevronRight, Flag, ShieldCheck, Store, XCircle } from 'lucide-react';
import { BottomNav } from '../components/Shell';
import { Note, Reveal, StepHeader } from '../components/ui';

/** External services are signposts only: links out, no data exchanged, access unconfirmed. */
export const SIGNPOSTS = [
  {
    name: 'mPedigree GoldKeys',
    action: 'Check if your pack is genuine',
    body: 'If your pack has a scratch-off code, scratch it and send the code by free SMS as printed on the pack. You get a reply saying whether it is genuine.',
    url: 'https://goldkeys.org/how-it-works/',
    Icon: BadgeCheck,
  },
  {
    name: 'National Electronic Pharmacy Platform',
    action: 'Find a licensed pharmacy',
    body: 'Pharmacy Council-supported platform for reaching licensed pharmacies online, for example to send a prescription.',
    url: 'https://gnepplatform.com/',
    Icon: Store,
  },
  {
    name: 'FDA Ghana · Med Safety',
    action: 'Report a side effect',
    body: 'The Food and Drugs Authority’s reporting channels, including the Med Safety app, for side effects and other medicine problems.',
    url: 'https://fdaghana.gov.gh/pharmacovigilance-safety-monitoring/',
    Icon: Flag,
  },
  {
    name: 'FDA Ghana Products Register',
    action: 'Look up a registered product',
    body: 'The official list of registered medicines. Real MediTrust data would come from here.',
    url: 'https://verifypermit.fdaghana.gov.gh/publicsearch',
    Icon: BookOpen,
  },
];

export default function Help() {
  return (
    <>
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <StepHeader label="Get help" />
        <div className="px-5 pb-8">
          <Reveal>
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-navy-900">Services that can help</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">These are separate services run by others. MediTrust links to them; it does not share your data with them.</p>
          </Reveal>
          <div className="mt-5 space-y-3">
            {SIGNPOSTS.map((s, k) => (
              <Reveal key={s.name} i={k + 1}>
                <a href={s.url} target="_blank" rel="noreferrer" className="card flex gap-4 p-4 hover:border-teal-200">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                    <s.Icon size={20} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-[15px] font-bold text-navy-900">{s.action}</span>
                    <span className="block text-[12px] font-semibold text-teal-700">{s.name}</span>
                    <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">{s.body}</span>
                  </span>
                  <ChevronRight size={16} className="mt-1 text-muted" />
                </a>
              </Reveal>
            ))}
          </div>

          <Reveal i={6} className="card mt-6 p-5">
            <h2 className="text-[15px] font-bold text-navy-900">What MediTrust is, and is not</h2>
            <ul className="mt-3 space-y-2.5 text-[13.5px] leading-snug">
              {[
                [true, 'Checks a medicine against your own profile, before you take it'],
                [true, 'Explains possible risks in plain words'],
                [true, 'Sends you to a pharmacist or doctor'],
                [false, 'Does not diagnose or prescribe'],
                [false, 'Never suggests a replacement or tells you to stop a medicine'],
                [false, 'Never calls a medicine “safe”'],
              ].map(([ok, t]) => (
                <li key={String(t)} className="flex gap-2.5 text-navy-900">
                  {ok ? <ShieldCheck size={17} className="mt-0.5 shrink-0 text-teal-600" /> : <XCircle size={17} className="mt-0.5 shrink-0 text-risk-high" />}
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal i={7} className="mt-4">
            <Note title="If you feel very unwell">Go to the nearest health facility or call for emergency help. Do not wait for an app.</Note>
          </Reveal>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
