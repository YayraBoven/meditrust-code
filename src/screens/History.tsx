import { ChevronRight, Pill, ScanSearch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/Shell';
import { Press, Reveal, RiskBadge } from '../components/ui';
import { medicineById } from '../data/medicines';
import { displayLevel } from '../engine/checks';
import { useApp } from '../store/useApp';

export default function History() {
  const navigate = useNavigate();
  const { history, clearHistory, resetDraft } = useApp();
  return (
    <>
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="px-5 pb-8 pt-[max(env(safe-area-inset-top),22px)]">
          <Reveal className="flex items-end justify-between">
            <div>
              <div className="eyebrow">Saved on this phone</div>
              <h1 className="mt-2 text-[28px] font-extrabold tracking-tight text-navy-900">Past checks</h1>
            </div>
            {history.length > 0 && (
              <button onClick={() => window.confirm('Clear all past checks from this phone?') && clearHistory()} className="pb-1 text-[12.5px] font-bold text-muted hover:text-risk-high">
                Clear
              </button>
            )}
          </Reveal>
          {history.length === 0 ? (
            <Reveal i={1} className="mt-16 flex flex-col items-center text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-teal-100 text-teal-700">
                <ScanSearch size={34} />
              </span>
              <div className="mt-5 text-[17px] font-bold text-navy-900">No checks yet</div>
              <p className="mt-1 max-w-[260px] text-[13.5px] text-muted">Your results will appear here so you can show them to a pharmacist later.</p>
              <Press
                onClick={() => {
                  resetDraft();
                  navigate('/app/check');
                }}
                className="btn-primary mt-6 w-auto px-6"
              >
                Check a medicine
              </Press>
            </Reveal>
          ) : (
            <ul className="mt-5 space-y-3">
              {history.map((h, k) => (
                <Reveal key={h.id} i={k + 1}>
                  <Press onClick={() => navigate(`/app/result/${h.id}`)} className="card flex w-full items-center gap-3 p-4 text-left">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-canvas text-navy-900">
                      <Pill size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-bold text-navy-900">{h.result.medicineIds.map((id) => medicineById(id)?.brand).join(' + ')}</span>
                      <span className="block text-[12px] text-muted">
                        {new Date(h.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {h.result.flags.length} finding{h.result.flags.length === 1 ? '' : 's'}
                      </span>
                    </span>
                    <RiskBadge level={displayLevel(h.result)} />
                    <ChevronRight size={16} className="text-muted" />
                  </Press>
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </div>
      <BottomNav />
    </>
  );
}
