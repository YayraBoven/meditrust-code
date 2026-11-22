import { useNavigate } from 'react-router-dom';
import { DEMO_CASES } from '../data/demo';
import { useApp } from '../store/useApp';

/** Loads a demo patient and takes the presenter straight to the medicine step. */
export function useStartDemo() {
  const navigate = useNavigate();
  return (id: string) => {
    const d = DEMO_CASES.find((c) => c.id === id);
    if (!d) return;
    const s = useApp.getState();
    // Each demo patient is their own person, so a real profile on this phone is never overwritten.
    s.openDemoPerson(d.id, d.profile);
    s.setConsent(true);
    s.setOnboarded(true);
    s.resetDraft();
    s.setDraft({ query: d.check.query });
    navigate('/app/check');
  };
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';
