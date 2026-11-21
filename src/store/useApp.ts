import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { EMPTY_PROFILE } from '../data/demo';
import type { CheckResult, Profile } from '../data/types';

export interface HistoryEntry {
  id: string;
  at: string; // ISO date
  result: CheckResult;
}

interface Draft {
  medicineIds: string[];
  pendingId: string | null; // medicine waiting for confirmation
  prescribed: boolean | null;
  query: string;
}

interface AppState {
  onboarded: boolean;
  consent: boolean;
  profile: Profile;
  history: HistoryEntry[];
  draft: Draft;
  demoId: string | null;
  setOnboarded: (v: boolean) => void;
  setConsent: (v: boolean) => void;
  setProfile: (p: Profile) => void;
  updateProfile: (p: Partial<Profile>) => void;
  setDraft: (d: Partial<Draft>) => void;
  resetDraft: () => void;
  addHistory: (r: CheckResult) => string;
  clearHistory: () => void;
  setDemo: (id: string | null) => void;
  resetAll: () => void;
}

const EMPTY_DRAFT: Draft = { medicineIds: [], pendingId: null, prescribed: null, query: '' };

/** Storage can be unavailable (private mode, blocked site data). Never crash because of it. */
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      consent: false,
      profile: EMPTY_PROFILE,
      history: [],
      draft: EMPTY_DRAFT,
      demoId: null,
      setOnboarded: (onboarded) => set({ onboarded }),
      setConsent: (consent) => set({ consent }),
      setProfile: (profile) => set({ profile }),
      updateProfile: (p) => set({ profile: { ...get().profile, ...p } }),
      setDraft: (d) => set({ draft: { ...get().draft, ...d } }),
      resetDraft: () => set({ draft: EMPTY_DRAFT }),
      addHistory: (result) => {
        const id = `chk_${Date.now().toString(36)}`;
        set({ history: [{ id, at: new Date().toISOString(), result }, ...get().history].slice(0, 30) });
        return id;
      },
      clearHistory: () => set({ history: [] }),
      setDemo: (demoId) => set({ demoId }),
      resetAll: () => set({ onboarded: false, consent: false, profile: EMPTY_PROFILE, history: [], draft: EMPTY_DRAFT, demoId: null }),
    }),
    { name: 'meditrust-v1', storage: createJSONStorage(() => safeStorage) },
  ),
);
