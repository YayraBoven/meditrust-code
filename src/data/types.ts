export type RiskLevel = 'high' | 'medium' | 'low';

export type Condition =
  | 'hypertension'
  | 'diabetes'
  | 'asthma'
  | 'kidney'
  | 'liver'
  | 'sickle-cell'
  | 'stomach-ulcer';

export type AllergyGroup = 'penicillin' | 'sulfa' | 'nsaid';

export type G6pdStatus = 'deficient' | 'normal' | 'family-history' | 'not-sure' | 'never-tested';

export interface Ingredient {
  id: string;
  name: string;
  /** Allergy groups this ingredient belongs to. */
  allergyGroups?: AllergyGroup[];
  /** Plain-language class shown to users, e.g. "pain reliever". */
  kind: string;
}

export interface Medicine {
  id: string;
  /** Brand names are invented for the prototype and marked as demo samples. */
  brand: string;
  generic: string;
  strength: string;
  form: 'Tablet' | 'Capsule' | 'Syrup' | 'Caplet';
  ingredients: string[];
  prescriptionOnly: boolean;
  /** Extra words people might type. */
  aliases?: string[];
}

export interface Profile {
  name: string;
  age: number | null;
  allergies: AllergyGroup[];
  otherAllergies: string;
  allergyAnswer: 'none' | 'some' | 'not-sure';
  conditions: Condition[];
  currentMedicines: string[]; // medicine ids
  pregnancy: 'pregnant' | 'not-pregnant' | 'not-applicable' | 'breastfeeding';
  trimester: 1 | 2 | 3 | null;
  g6pd: G6pdStatus;
}

export type CheckKind = 'g6pd-pregnancy' | 'self-medication' | 'duplicate';

export interface Flag {
  id: string;
  check: CheckKind;
  level: RiskLevel;
  title: string;
  /** Plain-language explanation produced from the rule (never by AI). */
  message: string;
  /** Short reason code, kept in the audit log. */
  reason: string;
  ingredient?: string;
}

export interface CheckResult {
  medicineIds: string[];
  prescribed: boolean | null;
  level: RiskLevel;
  flags: Flag[];
  checksRun: { kind: CheckKind; label: string; flagged: boolean }[];
}
