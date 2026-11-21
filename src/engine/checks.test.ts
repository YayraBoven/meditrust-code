import { describe, expect, it } from 'vitest';
import { DEMO_CASES, EMPTY_PROFILE } from '../data/demo';
import { registerExternal } from '../data/medicines';
import { displayLevel, prescriberTopics, runChecks } from './checks';
import { toMedicine } from './rxnorm';
import { medicinesFromFacts } from './aiRead';
import { candidateWords, findMedicinesInText, unknownBrandPhrases } from './ocr';
import { composeWarning, passesSafetyFilter, resultCopy } from './explain';
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

describe('reading a pack photo', () => {
  it('finds the medicine named in pack text, preferring the printed strength', () => {
    const text = 'DEMO SAMPLE\nIbucare 200\nIbuprofen Tablets BP 200 mg\n24 tablets\nKeep out of reach of children';
    const found = findMedicinesInText(text);
    expect(found[0].medicine.id).toBe('ibucare-200');
  });

  it('copes with a generic pack and OCR noise', () => {
    const found = findMedicinesInText('Artemether / Lumefantrine\n20mg/120mg tablets ~ Batch No: A12 |');
    expect(found.some((f) => f.medicine.ingredients.includes('artemether'))).toBe(true);
  });

  it('ignores packaging words and finds nothing in unrelated text', () => {
    expect(findMedicinesInText('Store below 30C. Keep out of reach of children. Batch 12 Exp 2027')).toHaveLength(0);
    expect(candidateWords('Store below 30C. Keep tablets dry. Exp 2027')).toEqual([]);
  });
});

describe('pack text ranking', () => {
  it('prefers the product whose ingredients are all printed on the pack', () => {
    const found = findMedicinesInText('Panadol Extra\nParacetamol 500 mg / Caffeine 65 mg\n20 tablets');
    expect(found[0].medicine.id).toBe('paraplus-extra');
  });
  it('spots an unknown brand name worth looking up', () => {
    expect(unknownBrandPhrases('Panadol Extra\nParacetamol 500 mg / Caffeine 65 mg')).toEqual(['Panadol Extra']);
    expect(unknownBrandPhrases('Ibucare 200\nIbuprofen Tablets 200 mg')).toEqual([]);
  });
});

describe('brand lookup stays on the brand line', () => {
  it('does not look up packaging lines below a recognised name', () => {
    expect(unknownBrandPhrases('Ibucare 200\nIbuprofen Tablets 200 mg\n24 film-coated tablets')).toEqual([]);
    expect(unknownBrandPhrases('Magnesium Glycinate\n200 mg capsules\nDietary supplement 60 capsules')).toEqual([]);
  });
});

describe('AI pack reading results', () => {
  const facts = (brand: string, ings: [string, string][], pack = true) => ({
    is_medicine_pack: pack,
    brand_name: brand,
    active_ingredients: ings.map(([name, strength]) => ({ name, strength })),
    dosage_form: 'tablets',
    manufacturer: '',
    text_seen: '',
    confidence: 'high' as const,
  });

  it('a known demo brand matches our own entry first', () => {
    expect(medicinesFromFacts(facts('Ibucare 200', [['Ibuprofen', '200 mg']]))[0].id).toBe('ibucare-200');
  });

  it('an unknown brand is offered exactly as printed, then same-ingredient generics', () => {
    const list = medicinesFromFacts(facts('Panadol Extra', [['Paracetamol', '500 mg'], ['Caffeine', '65 mg']]));
    expect(list[0].source).toBe('photo');
    expect(list[0].brand).toBe('Panadol Extra');
    expect(list[0].ingredients).toEqual(['paracetamol', 'caffeine']);
    expect(list.some((m) => m.id === 'paraplus-extra')).toBe(true);
  });

  it('a printed medicine still goes through the safety rules', () => {
    const [m] = medicinesFromFacts(facts('Some Doxy', [['Doxycycline', '100 mg']]));
    registerExternal(m);
    const r = runChecks({ ...EMPTY_PROFILE, pregnancy: 'pregnant', trimester: 1, g6pd: 'normal' }, [m.id], true);
    expect(r.level).toBe('high');
  });

  it('nothing is offered when the photo is not a medicine pack', () => {
    expect(medicinesFromFacts(facts('', [], false))).toEqual([]);
  });
});

describe('prescribed medicines', () => {
  const pregnant = { ...EMPTY_PROFILE, pregnancy: 'pregnant' as const, trimester: 1 as const, g6pd: 'normal' as const };

  it('keeps the risk level but changes the advice when a doctor prescribed it', () => {
    const bought = runChecks(pregnant, ['g-misoprostol-200'], false);
    const rx = runChecks(pregnant, ['g-misoprostol-200'], true);
    expect(bought.level).toBe('high');
    expect(rx.level).toBe('high');
    expect(composeWarning(bought)).toMatch(/Do not start or stop/);
    expect(composeWarning(rx)).not.toMatch(/Do not start or stop/);
    expect(composeWarning(rx)).toMatch(/not sure your doctor knew/);
    expect(resultCopy(rx).headline).toBe('Prescribed for you: one thing to confirm');
    expect(prescriberTopics(rx)).toEqual(['your pregnancy']);
  });

  it('says the doctor knew, without lowering the level', () => {
    const r = runChecks(pregnant, ['g-misoprostol-200'], true, true);
    expect(r.level).toBe('high');
    expect(r.flags[0].discussed).toBe(true);
    expect(composeWarning(r)).toMatch(/Follow your doctor's instructions/);
    expect(resultCopy(r).headline).toBe('Prescribed for you: discussed with your doctor');
  });

  it('asks to tell the doctor when they did not know', () => {
    const r = runChecks(pregnant, ['g-misoprostol-200'], true, false);
    expect(composeWarning(r)).toMatch(/Tell the doctor who prescribed it/);
  });

  it('works the same way for G6PD, conditions and duplicates, not only pregnancy', () => {
    const kwame = demo('kwame');
    const g = runChecks({ ...kwame.profile, g6pd: 'deficient' }, kwame.check.medicineIds, true);
    expect(prescriberTopics(g)).toContain('your G6PD status');
    const kofi = demo('kofi');
    const c = runChecks(kofi.profile, kofi.check.medicineIds, true);
    expect(prescriberTopics(c)).toContain('your health condition');
    const efua = demo('efua');
    const d = runChecks(efua.profile, efua.check.medicineIds, true);
    expect(prescriberTopics(d)).toContain('the other medicines you take');
  });

  it('ignores the doctor answer when it was not prescribed, and every message still refers to a professional', () => {
    const r = runChecks(pregnant, ['g-misoprostol-200'], false, true);
    expect(r.prescriberKnew).toBeNull();
    expect(prescriberTopics(r)).toEqual([]);
    for (const knew of [true, false, null]) {
      expect(passesSafetyFilter(composeWarning(runChecks(pregnant, ['g-misoprostol-200'], true, knew)))).toBe(true);
    }
  });
});
