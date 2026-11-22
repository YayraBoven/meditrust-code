import { describe, expect, it } from 'vitest';
import { matchRxLine, type RxLine } from './rxRead';

const line = (name: string, strength = '', legible: RxLine['legible'] = 'clear'): RxLine => ({ name, strength, form: '', directions: '', legible });

describe('prescription lines', () => {
  it('matches clearly written generic and brand names', () => {
    expect(matchRxLine(line('Amoxicillin', '500mg'))?.ingredients).toContain('amoxicillin');
    expect(matchRxLine(line('Paracetamol', '500 mg'))?.ingredients).toContain('paracetamol');
    expect(matchRxLine(line('Ibucare'))?.ingredients).toContain('ibuprofen');
  });

  it('prefers the strength written on the prescription', () => {
    const m = matchRxLine(line('Paracetamol', '500mg'));
    expect(m?.strength).toMatch(/500/);
  });

  it('never turns a single medicine into a combination product', () => {
    for (const n of ['Paracetamol', 'Amoxicillin', 'Ibuprofen', 'Metronidazole', 'Omeprazole']) {
      const m = matchRxLine(line(n));
      expect(m?.ingredients.length, n).toBe(1);
    }
  });

  it('keeps the strength written when we have no product of that strength', () => {
    const m = matchRxLine(line('Paracetamol', '1g'));
    expect(m?.ingredients).toEqual(['paracetamol']);
    expect(m?.strength).toBe('1g');
  });

  it('picks tablets rather than syrup unless syrup is written', () => {
    expect(matchRxLine(line('Ibuprofen'))?.form).not.toMatch(/syrup/i);
    expect(matchRxLine({ ...line('Ibuprofen', '100mg/5ml'), form: 'syrup' })?.strength).toMatch(/5 ?ml/);
  });

  it('never matches an unclear or too-short line', () => {
    expect(matchRxLine(line('Amoxicillin', '500mg', 'unclear'))).toBeNull();
    expect(matchRxLine(line('Am'))).toBeNull();
  });

  it('returns null for words that are not medicines', () => {
    expect(matchRxLine(line('Review in two weeks'))).toBeNull();
  });
});
