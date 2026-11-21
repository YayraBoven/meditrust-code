import { describe, expect, it } from 'vitest';
import { DEMO_CASES, EMPTY_PROFILE } from '../data/demo';
import { registerExternal } from '../data/medicines';
import { displayLevel, runChecks } from './checks';
import { toMedicine } from './rxnorm';
import { composeWarning, passesSafetyFilter } from './explain';
import { CONFIDENT, searchMedicines } from './match';

const demo = (id: string) => DEMO_CASES.find((d) => d.id === id)!;
const run = (id: string) => {
  const d = demo(id);
  return runChecks(d.profile, d.check.medicineIds, d.check.prescribed);
};

describe('demo scenarios from the team document', () => {
  it('Kofi: ibuprofen with hypertension is Medium', () => {
    const r = run('kofi');
    expect(r.level).toBe('medium');
    expect(r.flags[0].reason).toBe('cond-ibuprofen-htn');
    expect(r.flags.some((f) => f.reason === 'rx-only-not-prescribed')).toBe(false); // ibuprofen is over the counter
  });

  it('Ama: doxycycline in the first trimester is High', () => {
    const r = run('ama');
    expect(r.level).toBe('high');
    expect(r.flags[0].check).toBe('g6pd-pregnancy');
    expect(r.flags[0].reason).toBe('preg-doxycycline');
  });

  it('Kwame: primaquine with unknown G6PD status is a possible concern, never a confirmed deficiency', () => {
    const r = run('kwame');
    expect(r.level).toBe('medium');
    const g6pd = r.flags.find((f) => f.reason.startsWith('g6pd-primaquine'))!;
    expect(g6pd.level).toBe('medium');
    expect(g6pd.message).toMatch(/not a diagnosis/);
    expect(r.flags.some((f) => f.reason === 'rx-only-not-prescribed')).toBe(true);
  });

  it('Efua: a cold-and-flu product with paracetamol she already takes is a duplicate', () => {
    const r = run('efua');
    expect(r.level).toBe('medium');
    expect(r.flags.some((f) => f.check === 'duplicate' && f.ingredient === 'Paracetamol')).toBe(true);
  });
});

describe('rules engine behaviour', () => {
  it('known G6PD deficiency keeps the rule level (High for primaquine)', () => {
    const r = runChecks({ ...EMPTY_PROFILE, g6pd: 'deficient' }, ['primacare-15'], true);
    expect(r.level).toBe('high');
  });

  it('normal G6PD status raises no G6PD flag', () => {
    const r = runChecks({ ...EMPTY_PROFILE, g6pd: 'normal' }, ['primacare-15'], true);
    expect(r.flags.filter((f) => f.check === 'g6pd-pregnancy')).toHaveLength(0);
  });

  it('a medicine with no concerns returns Low and no flags', () => {
    const r = runChecks({ ...EMPTY_PROFILE, g6pd: 'normal' }, ['paracare-500'], false);
    expect(r.level).toBe('low');
    expect(r.flags).toHaveLength(0);
  });

  it('two products checked together are compared with each other', () => {
    const r = runChecks({ ...EMPTY_PROFILE, g6pd: 'normal' }, ['paracare-500', 'fluease-night'], false);
    expect(r.flags.some((f) => f.check === 'duplicate')).toBe(true);
  });

  it('penicillin allergy flags amoxicillin as High', () => {
    const r = runChecks({ ...EMPTY_PROFILE, allergies: ['penicillin'], g6pd: 'normal' }, ['clavucare-625'], true);
    expect(r.level).toBe('high');
  });

  it('a typed allergy is matched against ingredients', () => {
    const r = runChecks({ ...EMPTY_PROFILE, otherAllergies: 'metronidazole', g6pd: 'normal' }, ['metrocare-400'], true);
    expect(r.flags.some((f) => f.reason.startsWith('allergy-typed'))).toBe(true);
  });
});

describe('matcher', () => {
  it('finds a medicine by ingredient, brand or a typo', () => {
    expect(searchMedicines('ibuprofen')[0].medicine.ingredients).toContain('ibuprofen');
    expect(searchMedicines('coldaway')[0].medicine.id).toBe('coldaway-day');
    expect(searchMedicines('ibuprofin')[0].medicine.ingredients).toContain('ibuprofen');
  });

  it('returns nothing confident for an unknown medicine', () => {
    const r = searchMedicines('zzqx tonic');
    expect(r.every((m) => m.score < CONFIDENT)).toBe(true);
  });
});

describe('explanations and safety filter', () => {
  it('every composed warning passes the safety filter', () => {
    for (const d of DEMO_CASES) {
      const r = runChecks(d.profile, d.check.medicineIds, d.check.prescribed);
      expect(passesSafetyFilter(composeWarning(r, d.name))).toBe(true);
    }
  });

  it('rejects unsafe generated wording', () => {
    expect(passesSafetyFilter('It is safe, you can take it.')).toBe(false);
    expect(passesSafetyFilter('Stop taking your medicine. See a doctor.')).toBe(false);
  });
});

describe('broad coverage', () => {
  it('finds magnesium glycinate in the built-in list', () => {
    expect(searchMedicines('magnesium glycinate')[0].medicine.id).toBe('g-magnesium-glycinate');
  });

  it('tolerates a typo in a multi-word name', () => {
    expect(searchMedicines('magnesiun glycinate')[0]?.medicine.ingredients).toContain('magnesium');
  });

  it('applies rules to the wider Ghana list (warfarin in pregnancy is High)', () => {
    const r = runChecks({ ...EMPTY_PROFILE, pregnancy: 'pregnant', trimester: 2, g6pd: 'normal' }, ['g-warfarin-5'], true);
    expect(r.level).toBe('high');
  });

  it('a medicine whose ingredients have no rules is "unverified", never Low', () => {
    const r = runChecks({ ...EMPTY_PROFILE, g6pd: 'normal' }, ['g-fluoxetine-20'], true);
    expect(r.flags).toHaveLength(0);
    expect(displayLevel(r)).toBe('unverified');
    expect(composeWarning(r)).toMatch(/does not yet have verified safety information/);
  });

  it('maps RxNorm ingredients onto MediTrust ingredients where it can', () => {
    const mg = toMedicine('476818', 'magnesium glycinate', 'IN', ['magnesium glycinate']);
    expect(mg.ingredients).toEqual(['magnesium']);
    const tylenol = toMedicine('1', 'Panadol Extra', 'BN', ['acetaminophen', 'caffeine']);
    expect(tylenol.ingredients).toEqual(['paracetamol', 'caffeine']);
    const unknown = toMedicine('2', 'Some Herbal Mix', 'BN', ['echinacea']);
    expect(unknown.ingredients[0]).toMatch(/^rxing-/);
    expect(unknown.prescriptionOnly).toBeNull();
  });

  it('an RxNorm medicine with an unknown ingredient still gets the duplicate check', () => {
    const a = toMedicine('10', 'Brand A', 'BN', ['echinacea']);
    const b = toMedicine('11', 'Brand B', 'BN', ['echinacea']);
    registerExternal(a);
    registerExternal(b);
    const r = runChecks({ ...EMPTY_PROFILE, g6pd: 'normal', currentMedicines: [b.id] }, [a.id], false);
    expect(r.flags.some((f) => f.check === 'duplicate')).toBe(true);
    expect(r.unassessed).toContain('Echinacea');
  });
});
