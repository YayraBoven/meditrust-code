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

  it('never matches an unclear or too-short line', () => {
    expect(matchRxLine(line('Amoxicillin', '500mg', 'unclear'))).toBeNull();
    expect(matchRxLine(line('Am'))).toBeNull();
  });

  it('returns null for words that are not medicines', () => {
    expect(matchRxLine(line('Review in two weeks'))).toBeNull();
  });
});
