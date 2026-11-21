import type { Profile } from './types';

export const EMPTY_PROFILE: Profile = {
  name: '',
  age: null,
  allergies: [],
  otherAllergies: '',
  allergyAnswer: 'none',
  conditions: [],
  currentMedicines: [],
  pregnancy: 'not-applicable',
  trimester: null,
  g6pd: 'never-tested',
};

export interface DemoCase {
  id: string;
  name: string;
  summary: string;
  profile: Profile;
  /** What to check in the demo, and whether it was prescribed. */
  check: { medicineIds: string[]; prescribed: boolean; query: string };
  expect: string;
}

/** The four scenarios from the team document (Section 2 and the demo script). */
export const DEMO_CASES: DemoCase[] = [
  {
    id: 'kofi',
    name: 'Kofi',
    summary: '62 · hypertension and diabetes · checks ibuprofen',
    profile: { ...EMPTY_PROFILE, name: 'Kofi', age: 62, conditions: ['hypertension', 'diabetes'], currentMedicines: ['amlocare-5', 'metcare-500'], pregnancy: 'not-applicable', g6pd: 'normal' },
    check: { medicineIds: ['ibucare-200'], prescribed: false, query: 'ibuprofen' },
    expect: 'Medium: ibuprofen can raise blood pressure',
  },
  {
    id: 'ama',
    name: 'Ama',
    summary: '28 · pregnant, first trimester · checks doxycycline',
    profile: { ...EMPTY_PROFILE, name: 'Ama', age: 28, pregnancy: 'pregnant', trimester: 1, currentMedicines: ['fefol-care'], g6pd: 'normal' },
    check: { medicineIds: ['doxycare-100'], prescribed: true, query: 'doxycycline' },
    expect: 'High: not recommended in pregnancy',
  },
  {
    id: 'kwame',
    name: 'Kwame',
    summary: '19 · not sure about G6PD · checks primaquine',
    profile: { ...EMPTY_PROFILE, name: 'Kwame', age: 19, pregnancy: 'not-applicable', g6pd: 'not-sure' },
    check: { medicineIds: ['primacare-15'], prescribed: false, query: 'primaquine' },
    expect: 'Medium: possible G6PD concern, plus needs a prescription',
  },
  {
    id: 'efua',
    name: 'Efua',
    summary: '34 · takes paracetamol · checks a cold-and-flu product',
    profile: { ...EMPTY_PROFILE, name: 'Efua', age: 34, pregnancy: 'not-pregnant', currentMedicines: ['paracare-500'], g6pd: 'normal' },
    check: { medicineIds: ['coldaway-day'], prescribed: false, query: 'coldaway' },
    expect: 'Medium: both contain paracetamol',
  },
];
