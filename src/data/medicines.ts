import { EXTRA_INGREDIENTS, GHANA_MEDICINES } from './generics';
import type { Ingredient, Medicine } from './types';

/**
 * ILLUSTRATIVE DATA FOR THE PROTOTYPE.
 * Ingredient names are real; brand names are invented demo samples so that no real
 * company or product is misrepresented. A pharmacist must review every entry,
 * and real data would come from the Ghana FDA Products Register.
 */

const DEMO_INGREDIENTS: Record<string, Ingredient> = {
  paracetamol: { id: 'paracetamol', name: 'Paracetamol', kind: 'pain and fever reliever' },
  ibuprofen: { id: 'ibuprofen', name: 'Ibuprofen', kind: 'anti-inflammatory pain reliever (NSAID)', allergyGroups: ['nsaid'] },
  diclofenac: { id: 'diclofenac', name: 'Diclofenac', kind: 'anti-inflammatory pain reliever (NSAID)', allergyGroups: ['nsaid'] },
  aspirin: { id: 'aspirin', name: 'Aspirin', kind: 'pain reliever (NSAID)', allergyGroups: ['nsaid'] },
  phenylephrine: { id: 'phenylephrine', name: 'Phenylephrine', kind: 'decongestant' },
  chlorphenamine: { id: 'chlorphenamine', name: 'Chlorphenamine', kind: 'antihistamine' },
  loratadine: { id: 'loratadine', name: 'Loratadine', kind: 'antihistamine' },
  caffeine: { id: 'caffeine', name: 'Caffeine', kind: 'stimulant' },
  amoxicillin: { id: 'amoxicillin', name: 'Amoxicillin', kind: 'antibiotic (penicillin)', allergyGroups: ['penicillin'] },
  clavulanate: { id: 'clavulanate', name: 'Clavulanic acid', kind: 'antibiotic helper' },
  sulfamethoxazole: { id: 'sulfamethoxazole', name: 'Sulfamethoxazole', kind: 'antibiotic (sulfonamide)', allergyGroups: ['sulfa'] },
  trimethoprim: { id: 'trimethoprim', name: 'Trimethoprim', kind: 'antibiotic' },
  ciprofloxacin: { id: 'ciprofloxacin', name: 'Ciprofloxacin', kind: 'antibiotic' },
  doxycycline: { id: 'doxycycline', name: 'Doxycycline', kind: 'antibiotic (tetracycline)' },
  metronidazole: { id: 'metronidazole', name: 'Metronidazole', kind: 'antibiotic' },
  nitrofurantoin: { id: 'nitrofurantoin', name: 'Nitrofurantoin', kind: 'antibiotic' },
  artemether: { id: 'artemether', name: 'Artemether', kind: 'antimalarial' },
  lumefantrine: { id: 'lumefantrine', name: 'Lumefantrine', kind: 'antimalarial' },
  artesunate: { id: 'artesunate', name: 'Artesunate', kind: 'antimalarial' },
  amodiaquine: { id: 'amodiaquine', name: 'Amodiaquine', kind: 'antimalarial' },
  primaquine: { id: 'primaquine', name: 'Primaquine', kind: 'antimalarial' },
  dapsone: { id: 'dapsone', name: 'Dapsone', kind: 'antibacterial' },
  amlodipine: { id: 'amlodipine', name: 'Amlodipine', kind: 'blood pressure medicine' },
  metformin: { id: 'metformin', name: 'Metformin', kind: 'diabetes medicine' },
  prednisolone: { id: 'prednisolone', name: 'Prednisolone', kind: 'steroid' },
  omeprazole: { id: 'omeprazole', name: 'Omeprazole', kind: 'stomach acid reducer' },
  ferrous: { id: 'ferrous', name: 'Ferrous sulfate (iron)', kind: 'iron supplement' },
  folic: { id: 'folic', name: 'Folic acid', kind: 'vitamin' },
};

const DEMO_MEDICINES: Medicine[] = [
  { id: 'paracare-500', brand: 'Paracare 500', generic: 'Paracetamol 500 mg', strength: '500 mg', form: 'Tablet', ingredients: ['paracetamol'], prescriptionOnly: false, aliases: ['acetaminophen', 'para'] },
  { id: 'paraplus-extra', brand: 'ParaPlus Extra', generic: 'Paracetamol + Caffeine', strength: '500 mg / 65 mg', form: 'Caplet', ingredients: ['paracetamol', 'caffeine'], prescriptionOnly: false },
  { id: 'coldaway-day', brand: 'ColdAway Day', generic: 'Cold and flu (paracetamol + phenylephrine)', strength: '500 mg / 5 mg', form: 'Caplet', ingredients: ['paracetamol', 'phenylephrine'], prescriptionOnly: false, aliases: ['cold', 'flu', 'catarrh'] },
  { id: 'fluease-night', brand: 'FluEase Night', generic: 'Cold and flu (paracetamol + chlorphenamine)', strength: '500 mg / 2 mg', form: 'Tablet', ingredients: ['paracetamol', 'chlorphenamine'], prescriptionOnly: false, aliases: ['cold', 'flu'] },
  { id: 'ibucare-200', brand: 'Ibucare 200', generic: 'Ibuprofen 200 mg', strength: '200 mg', form: 'Tablet', ingredients: ['ibuprofen'], prescriptionOnly: false },
  { id: 'ibucare-400', brand: 'Ibucare 400', generic: 'Ibuprofen 400 mg', strength: '400 mg', form: 'Tablet', ingredients: ['ibuprofen'], prescriptionOnly: false },
  { id: 'dicloflex-50', brand: 'Dicloflex 50', generic: 'Diclofenac 50 mg', strength: '50 mg', form: 'Tablet', ingredients: ['diclofenac'], prescriptionOnly: true },
  { id: 'aspira-300', brand: 'Aspira 300', generic: 'Aspirin 300 mg', strength: '300 mg', form: 'Tablet', ingredients: ['aspirin'], prescriptionOnly: false },
  { id: 'allercare-4', brand: 'Allercare 4', generic: 'Chlorphenamine 4 mg', strength: '4 mg', form: 'Tablet', ingredients: ['chlorphenamine'], prescriptionOnly: false, aliases: ['allergy'] },
  { id: 'lorahist-10', brand: 'Lorahist 10', generic: 'Loratadine 10 mg', strength: '10 mg', form: 'Tablet', ingredients: ['loratadine'], prescriptionOnly: false, aliases: ['allergy'] },
  { id: 'amoxicare-500', brand: 'Amoxicare 500', generic: 'Amoxicillin 500 mg', strength: '500 mg', form: 'Capsule', ingredients: ['amoxicillin'], prescriptionOnly: true },
  { id: 'clavucare-625', brand: 'Clavucare 625', generic: 'Amoxicillin + Clavulanic acid', strength: '500 mg / 125 mg', form: 'Tablet', ingredients: ['amoxicillin', 'clavulanate'], prescriptionOnly: true, aliases: ['co-amoxiclav'] },
  { id: 'cotricare-960', brand: 'Cotricare 960', generic: 'Co-trimoxazole 960 mg', strength: '800 mg / 160 mg', form: 'Tablet', ingredients: ['sulfamethoxazole', 'trimethoprim'], prescriptionOnly: true, aliases: ['co-trimoxazole', 'cotrimoxazole'] },
  { id: 'ciprocare-500', brand: 'Ciprocare 500', generic: 'Ciprofloxacin 500 mg', strength: '500 mg', form: 'Tablet', ingredients: ['ciprofloxacin'], prescriptionOnly: true, aliases: ['cipro'] },
  { id: 'doxycare-100', brand: 'Doxycare 100', generic: 'Doxycycline 100 mg', strength: '100 mg', form: 'Capsule', ingredients: ['doxycycline'], prescriptionOnly: true, aliases: ['doxy'] },
  { id: 'metrocare-400', brand: 'Metrocare 400', generic: 'Metronidazole 400 mg', strength: '400 mg', form: 'Tablet', ingredients: ['metronidazole'], prescriptionOnly: true },
  { id: 'nitrocare-100', brand: 'Nitrocare 100', generic: 'Nitrofurantoin 100 mg', strength: '100 mg', form: 'Capsule', ingredients: ['nitrofurantoin'], prescriptionOnly: true },
  { id: 'lumacare', brand: 'Lumacare', generic: 'Artemether + Lumefantrine', strength: '20 mg / 120 mg', form: 'Tablet', ingredients: ['artemether', 'lumefantrine'], prescriptionOnly: false, aliases: ['malaria', 'act'] },
  { id: 'asaq-care', brand: 'ASAQ-Care', generic: 'Artesunate + Amodiaquine', strength: '100 mg / 270 mg', form: 'Tablet', ingredients: ['artesunate', 'amodiaquine'], prescriptionOnly: false, aliases: ['malaria', 'act'] },
  { id: 'primacare-15', brand: 'Primacare 15', generic: 'Primaquine 15 mg', strength: '15 mg', form: 'Tablet', ingredients: ['primaquine'], prescriptionOnly: true, aliases: ['malaria'] },
  { id: 'dapsocare-100', brand: 'Dapsocare 100', generic: 'Dapsone 100 mg', strength: '100 mg', form: 'Tablet', ingredients: ['dapsone'], prescriptionOnly: true },
  { id: 'amlocare-5', brand: 'Amlocare 5', generic: 'Amlodipine 5 mg', strength: '5 mg', form: 'Tablet', ingredients: ['amlodipine'], prescriptionOnly: true, aliases: ['blood pressure', 'bp'] },
  { id: 'metcare-500', brand: 'Metcare 500', generic: 'Metformin 500 mg', strength: '500 mg', form: 'Tablet', ingredients: ['metformin'], prescriptionOnly: true, aliases: ['sugar', 'diabetes'] },
  { id: 'predcare-5', brand: 'Predcare 5', generic: 'Prednisolone 5 mg', strength: '5 mg', form: 'Tablet', ingredients: ['prednisolone'], prescriptionOnly: true, aliases: ['steroid'] },
  { id: 'omecare-20', brand: 'Omecare 20', generic: 'Omeprazole 20 mg', strength: '20 mg', form: 'Capsule', ingredients: ['omeprazole'], prescriptionOnly: false, aliases: ['ulcer', 'acid'] },
  { id: 'fefol-care', brand: 'Fefol-Care', generic: 'Iron + Folic acid', strength: '150 mg / 0.5 mg', form: 'Capsule', ingredients: ['ferrous', 'folic'], prescriptionOnly: false, aliases: ['iron', 'blood tonic', 'pregnancy'] },
];

const SYNONYMS: Record<string, string[]> = {
  paracetamol: ['acetaminophen'],
  chlorphenamine: ['chlorpheniramine', 'chlorpheniramine maleate'],
  clavulanate: ['clavulanate', 'clavulanate potassium', 'clavulanic acid'],
  ferrous: ['ferrous sulfate', 'ferrous fumarate', 'iron'],
  folic: ['folic acid'],
  amoxicillin: ['amoxicillin trihydrate'],
  doxycycline: ['doxycycline hyclate', 'doxycycline monohydrate'],
  metformin: ['metformin hydrochloride'],
  amlodipine: ['amlodipine besylate'],
  ciprofloxacin: ['ciprofloxacin hydrochloride'],
  phenylephrine: ['phenylephrine hydrochloride'],
  diclofenac: ['diclofenac sodium', 'diclofenac potassium'],
  primaquine: ['primaquine phosphate'],
};

/** Every ingredient MediTrust knows. Demo ingredients were all written into the rules. */
export const INGREDIENTS: Record<string, Ingredient> = {
  ...Object.fromEntries(Object.values(DEMO_INGREDIENTS).map((i) => [i.id, { ...i, assessed: true, synonyms: SYNONYMS[i.id] }])),
  ...Object.fromEntries(EXTRA_INGREDIENTS.map((i) => [i.id, i])),
};

export const MEDICINES: Medicine[] = [...DEMO_MEDICINES.map((m) => ({ ...m, source: 'demo' as const })), ...GHANA_MEDICINES];

/* ---- External medicines (found in RxNorm) are registered at runtime. ---- */
const external = new Map<string, Medicine>();
export const registerExternal = (m: Medicine) => external.set(m.id, m);
export const externalMedicines = () => [...external.values()];

export const medicineById = (id: string): Medicine | undefined => MEDICINES.find((m) => m.id === id) ?? external.get(id);

export const ingredientName = (m: Medicine, ingId: string) => INGREDIENTS[ingId]?.name ?? m.ingredientLabels?.[ingId] ?? ingId;

export const ingredientNames = (m: Medicine) => m.ingredients.map((i) => ingredientName(m, i));

/** Map an ingredient name from another database (e.g. RxNorm) to MediTrust's own id. */
export function findIngredientId(name: string): string | undefined {
  const n = name.toLowerCase().trim();
  for (const i of Object.values(INGREDIENTS)) {
    if (i.name.toLowerCase() === n || i.id === n || i.synonyms?.includes(n)) return i.id;
  }
  // Salts and forms: "magnesium glycinate" -> magnesium, "zinc sulfate" -> zinc.
  for (const i of Object.values(INGREDIENTS)) {
    if (i.synonyms?.some((s) => n.startsWith(`${s} `))) return i.id;
    if (n.startsWith(`${i.name.toLowerCase()} `) && !['vitamin', 'insulin'].includes(i.name.toLowerCase())) return i.id;
  }
  return undefined;
}
