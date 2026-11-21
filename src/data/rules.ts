import type { AllergyGroup, Condition, RiskLevel } from './types';

/**
 * SAFETY RULES TABLE (illustrative, pending pharmacist review).
 *
 * This mirrors the "Safety Rules" table in the team document (Section 3, data):
 * one row per ingredient + risk factor. The rules engine reads these rows; it never
 * asks an AI model whether a medicine is risky.
 *
 * `message` is written for patients: short, plain words, no instruction to stop a
 * medicine, and the engine always adds the referral line.
 */

export type RuleFactor =
  | { type: 'g6pd' }
  | { type: 'pregnancy'; trimesters: (1 | 2 | 3)[] }
  | { type: 'breastfeeding' }
  | { type: 'condition'; condition: Condition }
  | { type: 'allergy'; group: AllergyGroup };

export interface SafetyRule {
  id: string;
  ingredient: string;
  factor: RuleFactor;
  level: RiskLevel;
  message: string;
  /** Where a pharmacist would confirm the rule. Placeholder until reviewed. */
  source: string;
  reviewed: false;
}

const PENDING = 'Illustrative: to be confirmed by a pharmacist against a trusted reference';

export const SAFETY_RULES: SafetyRule[] = [
  // --- G6PD deficiency ---
  { id: 'g6pd-primaquine', ingredient: 'primaquine', factor: { type: 'g6pd' }, level: 'high', message: 'Primaquine can damage red blood cells in people with G6PD deficiency.', source: PENDING, reviewed: false },
  { id: 'g6pd-dapsone', ingredient: 'dapsone', factor: { type: 'g6pd' }, level: 'high', message: 'Dapsone can damage red blood cells in people with G6PD deficiency.', source: PENDING, reviewed: false },
  { id: 'g6pd-nitrofurantoin', ingredient: 'nitrofurantoin', factor: { type: 'g6pd' }, level: 'medium', message: 'Nitrofurantoin may affect red blood cells in people with G6PD deficiency.', source: PENDING, reviewed: false },
  { id: 'g6pd-sulfamethoxazole', ingredient: 'sulfamethoxazole', factor: { type: 'g6pd' }, level: 'medium', message: 'Sulfa antibiotics such as co-trimoxazole may affect red blood cells in people with G6PD deficiency.', source: PENDING, reviewed: false },
  { id: 'g6pd-ciprofloxacin', ingredient: 'ciprofloxacin', factor: { type: 'g6pd' }, level: 'medium', message: 'Ciprofloxacin may affect red blood cells in some people with G6PD deficiency.', source: PENDING, reviewed: false },

  // --- Pregnancy ---
  { id: 'preg-doxycycline', ingredient: 'doxycycline', factor: { type: 'pregnancy', trimesters: [1, 2, 3] }, level: 'high', message: 'Doxycycline is usually not recommended during pregnancy.', source: PENDING, reviewed: false },
  { id: 'preg-primaquine', ingredient: 'primaquine', factor: { type: 'pregnancy', trimesters: [1, 2, 3] }, level: 'high', message: 'Primaquine is usually not used during pregnancy.', source: PENDING, reviewed: false },
  { id: 'preg-ibuprofen-early', ingredient: 'ibuprofen', factor: { type: 'pregnancy', trimesters: [1, 2] }, level: 'medium', message: 'Ibuprofen is usually avoided in pregnancy unless a doctor advises it.', source: PENDING, reviewed: false },
  { id: 'preg-ibuprofen-late', ingredient: 'ibuprofen', factor: { type: 'pregnancy', trimesters: [3] }, level: 'high', message: 'Ibuprofen is not recommended in the last three months of pregnancy.', source: PENDING, reviewed: false },
  { id: 'preg-diclofenac', ingredient: 'diclofenac', factor: { type: 'pregnancy', trimesters: [1, 2, 3] }, level: 'high', message: 'Diclofenac is usually avoided during pregnancy.', source: PENDING, reviewed: false },
  { id: 'preg-aspirin', ingredient: 'aspirin', factor: { type: 'pregnancy', trimesters: [1, 2, 3] }, level: 'medium', message: 'Aspirin at pain-relief doses is usually avoided in pregnancy unless a doctor advises it.', source: PENDING, reviewed: false },
  { id: 'preg-ciprofloxacin', ingredient: 'ciprofloxacin', factor: { type: 'pregnancy', trimesters: [1, 2, 3] }, level: 'medium', message: 'Ciprofloxacin is usually avoided in pregnancy unless a doctor decides it is needed.', source: PENDING, reviewed: false },
  { id: 'preg-sulfamethoxazole', ingredient: 'sulfamethoxazole', factor: { type: 'pregnancy', trimesters: [1] }, level: 'medium', message: 'Co-trimoxazole needs a doctor\'s review in the first three months of pregnancy.', source: PENDING, reviewed: false },
  { id: 'preg-prednisolone', ingredient: 'prednisolone', factor: { type: 'pregnancy', trimesters: [1, 2, 3] }, level: 'medium', message: 'Steroids such as prednisolone should only be used in pregnancy on a doctor\'s advice.', source: PENDING, reviewed: false },

  // --- Breastfeeding ---
  { id: 'bf-doxycycline', ingredient: 'doxycycline', factor: { type: 'breastfeeding' }, level: 'medium', message: 'Doxycycline needs a pharmacist\'s review while breastfeeding.', source: PENDING, reviewed: false },

  // --- Conditions (self-medication check) ---
  { id: 'cond-ibuprofen-htn', ingredient: 'ibuprofen', factor: { type: 'condition', condition: 'hypertension' }, level: 'medium', message: 'Ibuprofen can raise blood pressure, and you told us you have hypertension.', source: PENDING, reviewed: false },
  { id: 'cond-diclofenac-htn', ingredient: 'diclofenac', factor: { type: 'condition', condition: 'hypertension' }, level: 'medium', message: 'Diclofenac can raise blood pressure, and you told us you have hypertension.', source: PENDING, reviewed: false },
  { id: 'cond-phenylephrine-htn', ingredient: 'phenylephrine', factor: { type: 'condition', condition: 'hypertension' }, level: 'medium', message: 'This product contains a decongestant (phenylephrine) that can raise blood pressure, and you told us you have hypertension.', source: PENDING, reviewed: false },
  { id: 'cond-ibuprofen-kidney', ingredient: 'ibuprofen', factor: { type: 'condition', condition: 'kidney' }, level: 'high', message: 'Ibuprofen can put extra strain on the kidneys, and you told us you have a kidney condition.', source: PENDING, reviewed: false },
  { id: 'cond-diclofenac-kidney', ingredient: 'diclofenac', factor: { type: 'condition', condition: 'kidney' }, level: 'high', message: 'Diclofenac can put extra strain on the kidneys, and you told us you have a kidney condition.', source: PENDING, reviewed: false },
  { id: 'cond-ibuprofen-asthma', ingredient: 'ibuprofen', factor: { type: 'condition', condition: 'asthma' }, level: 'medium', message: 'In some people with asthma, ibuprofen can make breathing worse.', source: PENDING, reviewed: false },
  { id: 'cond-aspirin-asthma', ingredient: 'aspirin', factor: { type: 'condition', condition: 'asthma' }, level: 'medium', message: 'In some people with asthma, aspirin can make breathing worse.', source: PENDING, reviewed: false },
  { id: 'cond-ibuprofen-ulcer', ingredient: 'ibuprofen', factor: { type: 'condition', condition: 'stomach-ulcer' }, level: 'high', message: 'Ibuprofen can irritate the stomach, and you told us you have a stomach ulcer.', source: PENDING, reviewed: false },
  { id: 'cond-diclofenac-ulcer', ingredient: 'diclofenac', factor: { type: 'condition', condition: 'stomach-ulcer' }, level: 'high', message: 'Diclofenac can irritate the stomach, and you told us you have a stomach ulcer.', source: PENDING, reviewed: false },
  { id: 'cond-aspirin-ulcer', ingredient: 'aspirin', factor: { type: 'condition', condition: 'stomach-ulcer' }, level: 'high', message: 'Aspirin can irritate the stomach, and you told us you have a stomach ulcer.', source: PENDING, reviewed: false },
  { id: 'cond-prednisolone-diabetes', ingredient: 'prednisolone', factor: { type: 'condition', condition: 'diabetes' }, level: 'medium', message: 'Prednisolone can raise blood sugar, and you told us you have diabetes.', source: PENDING, reviewed: false },
  { id: 'cond-metformin-kidney', ingredient: 'metformin', factor: { type: 'condition', condition: 'kidney' }, level: 'medium', message: 'Metformin needs a doctor\'s review in people with a kidney condition.', source: PENDING, reviewed: false },

  // --- Allergies ---
  { id: 'allergy-penicillin', ingredient: 'amoxicillin', factor: { type: 'allergy', group: 'penicillin' }, level: 'high', message: 'Amoxicillin is a penicillin, and you told us you are allergic to penicillin.', source: PENDING, reviewed: false },
  { id: 'allergy-sulfa', ingredient: 'sulfamethoxazole', factor: { type: 'allergy', group: 'sulfa' }, level: 'high', message: 'This medicine contains a sulfa antibiotic, and you told us you are allergic to sulfa medicines.', source: PENDING, reviewed: false },
  { id: 'allergy-nsaid-ibuprofen', ingredient: 'ibuprofen', factor: { type: 'allergy', group: 'nsaid' }, level: 'high', message: 'Ibuprofen is in the same family as aspirin, and you told us you react to these pain relievers.', source: PENDING, reviewed: false },
  { id: 'allergy-nsaid-diclofenac', ingredient: 'diclofenac', factor: { type: 'allergy', group: 'nsaid' }, level: 'high', message: 'Diclofenac is in the same family as aspirin, and you told us you react to these pain relievers.', source: PENDING, reviewed: false },
  { id: 'allergy-nsaid-aspirin', ingredient: 'aspirin', factor: { type: 'allergy', group: 'nsaid' }, level: 'high', message: 'You told us you react to aspirin-type pain relievers.', source: PENDING, reviewed: false },
];
