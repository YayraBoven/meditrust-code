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
  /**
   * True when the rules table has been written with this ingredient in mind
   * (G6PD, pregnancy, conditions, allergies). If false, MediTrust can identify
   * the ingredient but must not report "no concern" for it.
   */
  assessed?: boolean;
  /** Other names for the same ingredient, e.g. RxNorm's "acetaminophen". */
  synonyms?: string[];
}

export type MedicineSource = 'demo' | 'ghana-list' | 'rxnorm' | 'photo';

export interface Medicine {
  id: string;
  /** Demo brand names are invented; Ghana-list entries use the generic name. */
  brand: string;
  generic: string;
  strength: string;
  form: string;
  ingredients: string[];
  /** null = unknown (e.g. found in RxNorm, Ghana status not recorded). */
  prescriptionOnly: boolean | null;
  /** Extra words people might type. */
  aliases?: string[];
  source?: MedicineSource;
  /** Display names for ingredients not in MediTrust's own table (RxNorm results). */
  ingredientLabels?: Record<string, string>;
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
  /** The fixed sentences that make up `message`, translated one by one. */
  parts?: string[];
  /** Names shown under the message (medicine, ingredient); never translated. */
  detail?: string;
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
  /** Ingredients MediTrust identified but has no verified rules for. */
  unassessed: string[];
  /** Medicines whose prescription status in Ghana is unknown. */
  unknownRxStatus: string[];
}

/** What the user sees: a risk level, or "no verified information yet". */
export type DisplayLevel = RiskLevel | 'unverified';
