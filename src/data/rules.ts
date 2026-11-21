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

/* ------------------------------------------------------------------ */
/* Rules for the wider Ghana list (same status: illustrative).        */
/* ------------------------------------------------------------------ */

const r = (id: string, ingredient: string, factor: RuleFactor, level: RiskLevel, message: string): SafetyRule => ({ id, ingredient, factor, level, message, source: PENDING, reviewed: false });
const preg = (t: (1 | 2 | 3)[]): RuleFactor => ({ type: 'pregnancy', trimesters: t });
const ALL: (1 | 2 | 3)[] = [1, 2, 3];
const cond = (condition: Condition): RuleFactor => ({ type: 'condition', condition });
const allergy = (group: AllergyGroup): RuleFactor => ({ type: 'allergy', group });
const G6PD: RuleFactor = { type: 'g6pd' };

const NSAIDS: [string, string][] = [['naproxen', 'Naproxen'], ['mefenamic', 'Mefenamic acid'], ['piroxicam', 'Piroxicam']];
const PENICILLINS: [string, string][] = [['ampicillin', 'Ampicillin'], ['cloxacillin', 'Cloxacillin'], ['flucloxacillin', 'Flucloxacillin'], ['phenoxymethylpenicillin', 'Penicillin V']];
const CEPHALOSPORINS: [string, string][] = [['cefuroxime', 'Cefuroxime'], ['cefixime', 'Cefixime'], ['ceftriaxone', 'Ceftriaxone'], ['cefalexin', 'Cefalexin']];
const ACE: [string, string][] = [['lisinopril', 'Lisinopril'], ['enalapril', 'Enalapril'], ['captopril', 'Captopril'], ['losartan', 'Losartan']];

export const EXTRA_RULES: SafetyRule[] = [
  // G6PD
  r('g6pd-quinine', 'quinine', G6PD, 'medium', 'Quinine may affect red blood cells in some people with G6PD deficiency.'),
  r('g6pd-chloroquine', 'chloroquine', G6PD, 'medium', 'Chloroquine may affect red blood cells in some people with G6PD deficiency.'),
  r('g6pd-methylene-blue', 'methylene-blue', G6PD, 'high', 'Methylene blue can damage red blood cells in people with G6PD deficiency.'),
  r('g6pd-sulfadoxine', 'sulfadoxine', G6PD, 'medium', 'Sulfa medicines such as SP may affect red blood cells in people with G6PD deficiency.'),

  // Pregnancy
  r('preg-warfarin', 'warfarin', preg(ALL), 'high', 'Warfarin is usually not used in pregnancy because it can harm the baby.'),
  ...ACE.flatMap(([id, name]) => [
    r(`preg-${id}-early`, id, preg([1]), 'medium', `${name} needs a doctor's review as soon as a pregnancy is known.`),
    r(`preg-${id}-late`, id, preg([2, 3]), 'high', `${name} is not recommended later in pregnancy because it can harm the baby.`),
  ]),
  r('preg-atorvastatin', 'atorvastatin', preg(ALL), 'high', 'Cholesterol medicines such as atorvastatin are usually stopped in pregnancy by a doctor.'),
  r('preg-simvastatin', 'simvastatin', preg(ALL), 'high', 'Cholesterol medicines such as simvastatin are usually stopped in pregnancy by a doctor.'),
  r('preg-methotrexate', 'methotrexate', preg(ALL), 'high', 'Methotrexate can seriously harm a baby and is not used in pregnancy.'),
  r('preg-misoprostol', 'misoprostol', preg(ALL), 'high', 'Misoprostol can cause miscarriage and must only be used under a doctor\'s direct care in pregnancy.'),
  r('preg-valproate', 'valproate', preg(ALL), 'high', 'Sodium valproate can harm a developing baby. A doctor must review it urgently.'),
  r('preg-isotretinoin', 'isotretinoin', preg(ALL), 'high', 'Isotretinoin can seriously harm a baby and is not used in pregnancy.'),
  r('preg-tetracycline', 'tetracycline', preg(ALL), 'high', 'Tetracycline is usually not recommended during pregnancy.'),
  r('preg-griseofulvin', 'griseofulvin', preg(ALL), 'high', 'Griseofulvin is not used in pregnancy.'),
  r('preg-hydroxyurea', 'hydroxyurea', preg(ALL), 'high', 'Hydroxyurea needs a specialist\'s review if you are pregnant.'),
  r('preg-carbamazepine', 'carbamazepine', preg(ALL), 'medium', 'Epilepsy medicines such as carbamazepine need a specialist\'s review in pregnancy. Do not change the dose on your own.'),
  r('preg-phenytoin', 'phenytoin', preg(ALL), 'medium', 'Epilepsy medicines such as phenytoin need a specialist\'s review in pregnancy. Do not change the dose on your own.'),
  ...NSAIDS.flatMap(([id, name]) => [
    r(`preg-${id}-early`, id, preg([1, 2]), 'medium', `${name} is usually avoided in pregnancy unless a doctor advises it.`),
    r(`preg-${id}-late`, id, preg([3]), 'high', `${name} is not recommended in the last three months of pregnancy.`),
  ]),
  r('preg-codeine', 'codeine', preg(ALL), 'medium', 'Codeine should only be used in pregnancy on a doctor\'s advice.'),
  r('preg-tramadol', 'tramadol', preg(ALL), 'medium', 'Tramadol should only be used in pregnancy on a doctor\'s advice.'),
  r('preg-albendazole', 'albendazole', preg([1]), 'medium', 'Deworming medicines such as albendazole are usually avoided in the first three months of pregnancy.'),
  r('preg-mebendazole', 'mebendazole', preg([1]), 'medium', 'Deworming medicines such as mebendazole are usually avoided in the first three months of pregnancy.'),
  r('preg-ivermectin', 'ivermectin', preg(ALL), 'medium', 'Ivermectin needs a doctor\'s review in pregnancy.'),
  r('preg-fluconazole', 'fluconazole', preg(ALL), 'medium', 'Fluconazole tablets need a doctor\'s review in pregnancy.'),
  r('preg-gentamicin', 'gentamicin', preg(ALL), 'medium', 'Gentamicin should only be used in pregnancy when a doctor decides it is needed.'),
  r('preg-levofloxacin', 'levofloxacin', preg(ALL), 'medium', 'Levofloxacin is usually avoided in pregnancy unless a doctor decides it is needed.'),
  r('preg-sulfadoxine', 'sulfadoxine', preg([1]), 'medium', 'SP is not usually given in the first three months of pregnancy. Your antenatal clinic will advise when.'),
  r('preg-dihydroartemisinin', 'dihydroartemisinin', preg([1]), 'medium', 'This malaria medicine needs a doctor\'s review in the first three months of pregnancy.'),
  r('preg-diazepam', 'diazepam', preg(ALL), 'medium', 'Diazepam should only be used in pregnancy on a doctor\'s advice.'),
  r('preg-dexamethasone', 'dexamethasone', preg(ALL), 'medium', 'Steroids such as dexamethasone should only be used in pregnancy on a doctor\'s advice.'),
  r('preg-atenolol', 'atenolol', preg(ALL), 'medium', 'Atenolol needs a doctor\'s review in pregnancy.'),
  r('preg-pseudoephedrine', 'pseudoephedrine', preg([1]), 'medium', 'Decongestants such as pseudoephedrine are usually avoided early in pregnancy.'),
  r('preg-vitamin-a', 'vitamin-a', preg(ALL), 'medium', 'High-dose vitamin A capsules can harm a baby. Ask your antenatal clinic before taking them.'),

  // Breastfeeding
  r('bf-codeine', 'codeine', { type: 'breastfeeding' }, 'high', 'Codeine can pass into breast milk and affect the baby.'),
  r('bf-tramadol', 'tramadol', { type: 'breastfeeding' }, 'medium', 'Tramadol needs a pharmacist\'s review while breastfeeding.'),
  r('bf-diazepam', 'diazepam', { type: 'breastfeeding' }, 'medium', 'Diazepam can make a breastfed baby sleepy.'),

  // Conditions
  ...NSAIDS.flatMap(([id, name]) => [
    r(`cond-${id}-htn`, id, cond('hypertension'), 'medium', `${name} can raise blood pressure, and you told us you have hypertension.`),
    r(`cond-${id}-kidney`, id, cond('kidney'), 'high', `${name} can put extra strain on the kidneys, and you told us you have a kidney condition.`),
    r(`cond-${id}-ulcer`, id, cond('stomach-ulcer'), 'high', `${name} can irritate the stomach, and you told us you have a stomach ulcer.`),
    r(`cond-${id}-asthma`, id, cond('asthma'), 'medium', `In some people with asthma, ${name.toLowerCase()} can make breathing worse.`),
  ]),
  r('cond-pseudoephedrine-htn', 'pseudoephedrine', cond('hypertension'), 'medium', 'Pseudoephedrine can raise blood pressure, and you told us you have hypertension.'),
  r('cond-propranolol-asthma', 'propranolol', cond('asthma'), 'high', 'Propranolol can trigger breathing problems in people with asthma.'),
  r('cond-atenolol-asthma', 'atenolol', cond('asthma'), 'medium', 'Atenolol can affect breathing in some people with asthma.'),
  r('cond-dexamethasone-diabetes', 'dexamethasone', cond('diabetes'), 'medium', 'Dexamethasone can raise blood sugar, and you told us you have diabetes.'),
  r('cond-glibenclamide-kidney', 'glibenclamide', cond('kidney'), 'medium', 'Glibenclamide needs a doctor\'s review in people with a kidney condition.'),
  r('cond-gliclazide-kidney', 'gliclazide', cond('kidney'), 'medium', 'Gliclazide needs a doctor\'s review in people with a kidney condition.'),
  r('cond-magnesium-kidney', 'magnesium', cond('kidney'), 'medium', 'Magnesium can build up in people with a kidney condition.'),
  r('cond-mgtrisilicate-kidney', 'magnesium-trisilicate', cond('kidney'), 'medium', 'Antacids with magnesium can build up in people with a kidney condition.'),
  r('cond-aluminium-kidney', 'aluminium-hydroxide', cond('kidney'), 'medium', 'Antacids with aluminium need a pharmacist\'s review in people with a kidney condition.'),
  r('cond-gentamicin-kidney', 'gentamicin', cond('kidney'), 'high', 'Gentamicin can harm the kidneys, and you told us you have a kidney condition.'),
  r('cond-atorvastatin-liver', 'atorvastatin', cond('liver'), 'medium', 'Atorvastatin needs a doctor\'s review in people with a liver condition.'),
  r('cond-simvastatin-liver', 'simvastatin', cond('liver'), 'medium', 'Simvastatin needs a doctor\'s review in people with a liver condition.'),
  r('cond-methotrexate-kidney', 'methotrexate', cond('kidney'), 'high', 'Methotrexate needs specialist care in people with a kidney condition.'),
  r('cond-methotrexate-liver', 'methotrexate', cond('liver'), 'high', 'Methotrexate needs specialist care in people with a liver condition.'),
  r('cond-warfarin-ulcer', 'warfarin', cond('stomach-ulcer'), 'high', 'Warfarin raises the risk of bleeding, and you told us you have a stomach ulcer.'),

  // Allergies
  ...PENICILLINS.map(([id, name]) => r(`allergy-penicillin-${id}`, id, allergy('penicillin'), 'high', `${name} is a penicillin, and you told us you are allergic to penicillin.`)),
  ...CEPHALOSPORINS.map(([id, name]) => r(`allergy-penicillin-${id}`, id, allergy('penicillin'), 'medium', `Some people who are allergic to penicillin also react to ${name.toLowerCase()}.`)),
  r('allergy-sulfa-sulfadoxine', 'sulfadoxine', allergy('sulfa'), 'high', 'SP contains a sulfa medicine, and you told us you are allergic to sulfa medicines.'),
  ...NSAIDS.map(([id, name]) => r(`allergy-nsaid-${id}`, id, allergy('nsaid'), 'high', `${name} is in the same family as aspirin, and you told us you react to these pain relievers.`)),
];

export const ALL_RULES: SafetyRule[] = [...SAFETY_RULES, ...EXTRA_RULES];
