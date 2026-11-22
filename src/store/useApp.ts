import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { EMPTY_PROFILE } from '../data/demo';
import { registerExternal } from '../data/medicines';
import type { CheckResult, Medicine, Profile } from '../data/types';
import type { Lang } from '../i18n';

export interface HistoryEntry {
  id: string;
  at: string; // ISO date
  result: CheckResult;
}

interface Draft {
  medicineIds: string[];
  pendingId: string | null; // medicine waiting for confirmation
  prescribed: boolean | null;
  /** Did the prescriber know about the profile points that raised warnings? */
  prescriberKnew?: boolean | null;
  query: string;
}

/** One person whose medicines are checked on this phone (e.g. a parent, a child, yourself). */
export interface Person {
  id: string;
  profile: Profile;
  history: HistoryEntry[];
  /** Set when this person is one of the built-in demo patients. */
  demoId: string | null;
}

interface AppState {
  onboarded: boolean;
  consent: boolean;
  profile: Profile;
  history: HistoryEntry[];
  draft: Draft;
  demoId: string | null;
  /** Everyone on this phone. `profile`, `history` and `demoId` above are the active person's. */
  people: Person[];
  activeId: string | null;
  switchPerson: (id: string) => void;
  /** Adds an empty person and makes them active; returns their id. */
  addPerson: () => string;
  /** Removes a person; if it was the active one, switches to another (or back to the welcome screen). */
  removePerson: (id: string) => void;
  /** Opens a demo patient as its own person (created once, reset to the demo profile each time). */
  openDemoPerson: (demoId: string, profile: Profile) => void;
  /** Medicines found in RxNorm, kept so past checks still show their names. */
  externals: Medicine[];
  addExternal: (m: Medicine) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
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

const EMPTY_DRAFT: Draft = { medicineIds: [], pendingId: null, prescribed: null, prescriberKnew: null, query: '' };

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

const newId = () => `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

type Mirror = Pick<AppState, 'profile' | 'history' | 'demoId' | 'people' | 'activeId'>;

/** The people list with the active person's latest profile, history and demo flag written back. */
function synced(s: Mirror): Person[] {
  if (!s.activeId) return s.people;
  return s.people.map((p) => (p.id === s.activeId ? { ...p, profile: s.profile, history: s.history, demoId: s.demoId } : p));
}

const load = (p: Person) => ({ profile: p.profile, history: p.history, demoId: p.demoId, activeId: p.id, draft: EMPTY_DRAFT });

/** Version 0 kept one profile: it becomes the first person, so nothing is lost. Exported for tests. */
export function migrateState(old: unknown, version: number): AppState {
  const s = (old ?? {}) as Partial<AppState>;
  if (version < 1) {
    const has = s.onboarded && s.profile;
    const id = 'p_first';
    return {
      ...s,
      people: has ? [{ id, profile: s.profile!, history: s.history ?? [], demoId: s.demoId ?? null }] : [],
      activeId: has ? id : null,
    } as AppState;
  }
  return s as AppState;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      /** Changes the active person's data and keeps the people list in step. */
      const commit = (patch: Partial<Mirror>) => {
        const s = { ...get(), ...patch };
        let { people, activeId } = s;
        if (!activeId) {
          // First profile on this phone: it becomes the first person.
          activeId = newId();
          people = [...people, { id: activeId, profile: s.profile, history: s.history, demoId: s.demoId }];
        }
        set({ ...patch, activeId, people: synced({ ...s, people, activeId }) });
      };
      return {
        onboarded: false,
        consent: false,
        profile: EMPTY_PROFILE,
        history: [],
        draft: EMPTY_DRAFT,
        demoId: null,
        people: [],
        activeId: null,
        externals: [],
        lang: 'en',
        setLang: (lang) => set({ lang }),
        addExternal: (m) => {
          registerExternal(m);
          if (!get().externals.some((e) => e.id === m.id)) set({ externals: [...get().externals, m].slice(-100) });
        },
        setOnboarded: (onboarded) => set({ onboarded }),
        setConsent: (consent) => set({ consent }),
        setProfile: (profile) => commit({ profile }),
        updateProfile: (p) => commit({ profile: { ...get().profile, ...p } }),
        setDraft: (d) => set({ draft: { ...get().draft, ...d } }),
        resetDraft: () => set({ draft: EMPTY_DRAFT }),
        addHistory: (result) => {
          const id = `chk_${Date.now().toString(36)}`;
          commit({ history: [{ id, at: new Date().toISOString(), result }, ...get().history].slice(0, 30) });
          return id;
        },
        clearHistory: () => commit({ history: [] }),
        setDemo: (demoId) => commit({ demoId }),
        switchPerson: (id) => {
          const people = synced(get());
          const p = people.find((x) => x.id === id);
          if (p) set({ people, ...load(p) });
        },
        addPerson: () => {
          const id = newId();
          const person: Person = { id, profile: EMPTY_PROFILE, history: [], demoId: null };
          set({ people: [...synced(get()), person], ...load(person) });
          return id;
        },
        removePerson: (id) => {
          const people = synced(get()).filter((p) => p.id !== id);
          if (get().activeId !== id) return set({ people });
          if (people.length) return set({ people, ...load(people[0]) });
          set({ people: [], activeId: null, onboarded: false, consent: false, profile: EMPTY_PROFILE, history: [], draft: EMPTY_DRAFT, demoId: null });
        },
        openDemoPerson: (demoId, profile) => {
          let people = synced(get());
          let p = people.find((x) => x.demoId === demoId);
          if (p) {
            p = { ...p, profile };
            people = people.map((x) => (x.id === p!.id ? p! : x));
          } else {
            p = { id: `demo-${demoId}`, profile, history: [], demoId };
            people = [...people, p];
          }
          set({ people, ...load(p) });
        },
        resetAll: () => set({ onboarded: false, consent: false, profile: EMPTY_PROFILE, history: [], draft: EMPTY_DRAFT, demoId: null, people: [], activeId: null }),
      };
    },
    {
      name: 'meditrust-v1',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      migrate: migrateState,
      onRehydrateStorage: () => (state) => state?.externals?.forEach(registerExternal),
    },
  ),
);
