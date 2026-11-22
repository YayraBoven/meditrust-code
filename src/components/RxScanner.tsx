import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Camera, Check as CheckIcon, FileText, ImageUp, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { ingredientNames } from '../data/medicines';
import type { Medicine } from '../data/types';
import { aiReadPrescription, matchRxLine, type RxLine } from '../engine/rxRead';
import { searchRxNorm } from '../engine/rxnorm';
import { Press } from './ui';
import { useT } from '../i18n';

type Stage = 'start' | 'reading' | 'results' | 'error';

interface Row {
  line: RxLine;
  medicine: Medicine | null;
  /** Why there is no medicine: unreadable, or not found anywhere. */
  problem?: 'unclear' | 'not-found';
  checked: boolean;
}

/**
 * Scan a doctor's prescription. AI reads only the medicine lines (never names);
 * each clear line is matched to a medicine, the user ticks what to check, and
 * everything is checked together as "prescribed".
 */
export function RxScanner({ onDone, onType }: { onDone: (meds: Medicine[]) => void; onType: () => void }) {
  const t = useT();
  const [stage, setStage] = useState<Stage>('start');
  const [photo, setPhoto] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);

  const read = async (file: File) => {
    setPhoto(URL.createObjectURL(file));
    setStage('reading');
    setError('');
    if (!navigator.onLine) {
      setError('Reading a prescription needs the internet. You can type each medicine instead.');
      setStage('error');
      return;
    }
    try {
      const facts = await aiReadPrescription(file);
      if (!facts.is_prescription || !facts.medicines.length) {
        setError('We could not find medicines on this photo. Try a clearer, closer photo of the prescription, or type each medicine.');
        setStage('error');
        return;
      }
      const out: Row[] = [];
      for (const line of facts.medicines) {
        if (line.legible !== 'clear' || line.name.trim().length < 3) {
          out.push({ line, medicine: null, problem: 'unclear', checked: false });
          continue;
        }
        let medicine = matchRxLine(line);
        if (!medicine) {
          try {
            [medicine] = await searchRxNorm(line.name, undefined, 1);
          } catch {
            medicine = null;
          }
        }
        out.push(medicine ? { line, medicine, checked: true } : { line, medicine: null, problem: 'not-found', checked: false });
      }
      setRows(out);
      setStage('results');
    } catch {
      setError('The AI reader is busy right now. Please try again in a moment, or type each medicine.');
      setStage('error');
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void read(f);
  };

  const chosen = rows.filter((r) => r.checked && r.medicine).map((r) => r.medicine!);
  const reset = () => {
    setStage('start');
    setRows([]);
    setPhoto(null);
  };

  return (
    <div className="mt-4">
      <input ref={captureRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      <AnimatePresence mode="wait">
        {stage === 'start' && (
          <motion.div key="start" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-xl3 border border-line bg-card p-5 shadow-card">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
              <FileText size={24} />
            </div>
            <h2 className="mt-3 text-[18px] font-extrabold text-navy-900">{t('Scan a prescription')}</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{t('Take a clear photo of the prescription paper. AI reads only the medicine names and directions, then you choose what to check.')}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Press onClick={() => captureRef.current?.click()} className="btn-primary !py-3 text-[14px]">
                <Camera size={17} /> {t('Take photo')}
              </Press>
              <Press onClick={() => fileRef.current?.click()} className="btn-secondary !py-3 text-[14px]">
                <ImageUp size={17} /> {t('Upload')}
              </Press>
            </div>
            <div className="mt-4 flex gap-2 rounded-2xl bg-canvas p-3 text-[12px] leading-relaxed text-navy-700">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-teal-600" />
              <span>{t('Your name and the doctor’s details are not read or kept. The photo is used once to read the medicines and is not stored.')}</span>
            </div>
          </motion.div>
        )}

        {stage === 'reading' && (
          <motion.div key="reading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center rounded-xl3 border border-line bg-card p-5 text-center shadow-card">
            {photo && <img src={photo} alt={t('Your prescription photo')} className="h-44 w-full rounded-2xl object-cover opacity-80" />}
            <Loader2 size={28} className="mt-4 animate-spin text-teal-600" />
            <div className="mt-2 text-[15px] font-bold text-navy-900">{t('Reading the prescription…')}</div>
            <div className="mt-1 text-[12.5px] text-muted">{t('This takes a few seconds.')}</div>
          </motion.div>
        )}

        {stage === 'error' && (
          <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl3 border border-line bg-card p-5 shadow-card">
            <div className="flex gap-3">
              <AlertTriangle size={20} className="mt-0.5 shrink-0 text-risk-medium" />
              <p className="text-[14px] leading-relaxed text-navy-900">{t(error)}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Press onClick={reset} className="btn-secondary !py-3 text-[14px]">
                <RotateCcw size={16} /> {t('Try again')}
              </Press>
              <Press onClick={onType} className="btn-secondary !py-3 text-[14px]">
                {t('Type instead')}
              </Press>
            </div>
          </motion.div>
        )}

        {stage === 'results' && (
          <motion.div key="results" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="text-[15px] font-bold text-navy-900">{t('We read these medicines')}</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{t('AI can misread handwriting. Check each name against your prescription, and untick anything that is wrong.')}</p>
            <div className="mt-3 space-y-2.5">
              {rows.map((r, k) =>
                r.medicine ? (
                  <Press
                    key={k}
                    onClick={() => setRows((cur) => cur.map((x, j) => (j === k ? { ...x, checked: !x.checked } : x)))}
                    className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors ${r.checked ? 'border-teal-600 bg-teal-50' : 'border-line bg-card'}`}
                  >
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 ${r.checked ? 'border-teal-600 bg-teal-600 text-white' : 'border-line'}`}>
                      {r.checked && <CheckIcon size={14} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold text-navy-900">{r.medicine.brand}</span>
                      <span className="block text-[12.5px] text-muted">
                        {ingredientNames(r.medicine).join(' + ')}
                        {r.medicine.strength ? ` · ${r.medicine.strength}` : ''}
                      </span>
                      <span className="mt-1 block text-[12px] text-navy-700">
                        {t('Written:')} “{[r.line.name, r.line.strength].filter(Boolean).join(' ')}”{r.line.directions ? ` · ${r.line.directions}` : ''}
                      </span>
                    </span>
                  </Press>
                ) : (
                  <div key={k} className="flex items-start gap-3 rounded-2xl border border-[#E7C27A] bg-risk-mediumBg p-3.5">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-risk-medium" />
                    <span className="text-[13px] leading-snug text-navy-900">
                      <span className="block font-bold">{t(r.problem === 'unclear' ? 'Could not read this line clearly' : 'Not found in our medicine list')}</span>
                      {r.line.name && <span className="block text-[12px] text-navy-700">{t('Written:')} “{[r.line.name, r.line.strength].filter(Boolean).join(' ')}”</span>}
                      <span className="block text-[12px] text-navy-700">{t('Please ask the pharmacist about this medicine.')}</span>
                    </span>
                  </div>
                ),
              )}
            </div>
            <div className="mt-4 space-y-2">
              <Press disabled={!chosen.length} onClick={() => onDone(chosen)} className="btn-primary">
                {t('Check these medicines')} ({chosen.length})
              </Press>
              <button onClick={reset} className="w-full py-2 text-[13px] font-bold text-teal-700">
                {t('Scan another photo')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
