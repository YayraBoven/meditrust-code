import { describe, expect, it } from 'vitest';
import type { Medicine } from '../data/types';
import { DOSE_UNCLEAR, classifyLine, exactMatch, isExactRemote, matchLine, type RxLine } from './rxRead';

const line = (name: string, strength = '', name_legibility: RxLine['name_legibility'] = 'clear', dose_legibility: RxLine['dose_legibility'] = strength ? 'clear' : 'none'): RxLine => ({
  name,
  strength,
  form: '',
  directions: '',
  name_legibility,
  dose_legibility,
});

describe('prescriptions: medicine names', () => {
  it('ticks a clearly read, real medicine', () => {
    const r = matchLine(line('Amoxicillin', '500 mg'));
    expect(r.status).toBe('ok');
    expect(r.medicine?.ingredients).toEqual(['amoxicillin']);
    expect(r.medicine?.strength).toMatch(/500/);
  });

  it('also ticks a name read "probably" when it is a real medicine', () => {
    expect(matchLine(line('Albendazole', '400mg', 'probably')).status).toBe('ok');
  });

  it('a barely readable name that is still a real medicine is offered unticked', () => {
    expect(matchLine(line('Albendazole', '400mg', 'unreadable')).status).toBe('unsure');
  });

  it('a misread that is not a real medicine is never matched', () => {
    expect(matchLine(line('Opropoxyphene', '200mg', 'probably')).status).toBe('not-found');
    expect(matchLine(line('Breezy', '', 'unreadable')).status).toBe('unreadable');
    expect(exactMatch(line('Amoxicilin', '500mg'))).toBeNull(); // one letter off: no fuzzy matching
  });

  it('never turns a single medicine into a combination product', () => {
    for (const n of ['Paracetamol', 'Amoxicillin', 'Ibuprofen', 'Metronidazole', 'Omeprazole']) {
      expect(exactMatch(line(n))?.ingredients.length, n).toBe(1);
    }
  });

  it('keeps the strength written when we have no product of that strength', () => {
    const m = exactMatch(line('Paracetamol', '1g'));
    expect(m?.ingredients).toEqual(['paracetamol']);
    expect(m?.strength).toBe('1g');
  });

  it('picks tablets rather than syrup unless syrup is written', () => {
    expect(exactMatch(line('Ibuprofen'))?.form).not.toMatch(/syrup/i);
    expect(exactMatch({ ...line('Ibuprofen', '100mg/5ml'), form: 'syrup' })?.strength).toMatch(/5 ?ml/);
  });

  it('matches our brand names exactly', () => {
    expect(exactMatch(line('Ibucare', '400mg'))?.strength).toMatch(/400/);
  });
});

describe('prescriptions: doses', () => {
  it('an unreadable dose does not block the check, but is flagged for the pharmacist', () => {
    const r = matchLine(line('Amoxicillin', '5?0mg', 'clear', 'unsure'));
    expect(r.status).toBe('ok');
    expect(r.doseUnsure).toBe(true);
    expect(r.medicine?.ingredients).toEqual(['amoxicillin']);
    expect(r.medicine?.strength).toBe(DOSE_UNCLEAR); // shown on the summary instead of a guessed dose
  });

  it('an unsure dose is never used to pick a product, and no dose appears in the name', () => {
    const r = matchLine(line('Paracetamol', '1g', 'clear', 'unsure'));
    expect(r.medicine?.strength).toBe(DOSE_UNCLEAR);
    expect(r.medicine?.brand).toBe('Paracetamol');
    const b = matchLine(line('Ibucare', '400mg', 'clear', 'unsure'));
    expect(b.medicine?.brand).toBe('Ibucare');
    expect(b.medicine?.ingredients).toEqual(['ibuprofen']);
  });
});

describe('prescriptions: wider database', () => {
  const remote = { id: 'rxnorm-1', brand: 'Olopatadine', generic: 'olopatadine', strength: '', form: '', ingredients: ['rxing-olopatadine'], prescriptionOnly: null, source: 'rxnorm' } as unknown as Medicine;

  it('accepts only an exact name match', () => {
    expect(isExactRemote(remote, 'Olopatadine')).toBe(true);
    expect(isExactRemote(remote, 'Olopatadin')).toBe(false);
  });

  it('classifies a wider-database medicine like our own', () => {
    expect(classifyLine(line('Olopatadine', '0.1%', 'clear', 'unsure'), remote).status).toBe('ok');
  });
});
