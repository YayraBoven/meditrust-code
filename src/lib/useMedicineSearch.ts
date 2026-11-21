import { useEffect, useMemo, useState } from 'react';
import type { Medicine } from '../data/types';
import { searchMedicines, type MatchResult } from '../engine/match';
import { searchRxNorm } from '../engine/rxnorm';

export type RemoteState = 'idle' | 'loading' | 'done' | 'offline';

/**
 * Searches MediTrust's own list instantly, then (after a short pause in typing)
 * RxNorm for anything the local list does not cover well.
 */
export function useMedicineSearch(query: string, localLimit = 6) {
  const local: MatchResult[] = useMemo(() => searchMedicines(query, localLimit), [query, localLimit]);
  const [remote, setRemote] = useState<Medicine[]>([]);
  const [state, setState] = useState<RemoteState>('idle');
  const strongLocal = local.length > 0 && local[0].score >= 0.9;

  useEffect(() => {
    const q = query.trim();
    setRemote([]);
    if (q.length < 3 || strongLocal) {
      setState('idle');
      return;
    }
    const ctrl = new AbortController();
    setState('loading');
    const t = setTimeout(async () => {
      try {
        const found = await searchRxNorm(q, ctrl.signal);
        // Hide RxNorm entries that only repeat an ingredient set already shown locally.
        const localSets = new Set(local.map((r) => [...r.medicine.ingredients].sort().join('|')));
        setRemote(found.filter((m) => !localSets.has([...m.ingredients].sort().join('|'))));
        setState('done');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setState('offline');
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, strongLocal]); // eslint-disable-line react-hooks/exhaustive-deps

  return { local, remote, state };
}
