import { INGREDIENTS, ingredientName, medicineById } from '../data/medicines';
import { ALL_RULES, type SafetyRule } from '../data/rules';
import type { CheckKind, CheckResult, DisplayLevel, Flag, Medicine, Profile, RiskLevel } from '../data/types';

/**
 * The clinical safety engine. Deterministic rules only: given the same profile and
 * medicines it always returns the same flags. No AI model is involved here.
 */

const RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
export const maxLevel = (levels: RiskLevel[]): RiskLevel =>
  levels.reduce<RiskLevel>((acc, l) => (RANK[l] > RANK[acc] ? l : acc), 'low');

const G6PD_UNSURE = new Set(['family-history', 'not-sure', 'never-tested']);

export const G6PD_UNSURE_NOTE =
  'You are not sure of your G6PD status, so this is a possible risk to discuss, not a diagnosis. Ask a pharmacist whether you should have a G6PD test first.';

/** Every warning title, in one place so all of them are translated. */
export const FLAG_TITLES = {
  g6pd: 'G6PD risk',
  g6pdUnsure: 'Possible G6PD concern',
  pregnancy: 'Pregnancy concern',
  breastfeeding: 'Breastfeeding concern',
  condition: 'Concern with your health condition',
  allergy: 'Possible allergy',
  rxOnly: 'Usually needs a prescription',
  duplicate: 'Same ingredient twice',
  alreadyTaking: 'You already take this medicine',
} as const;

/** What each kind of warning is about, phrased to follow "Did your doctor know about …". */
export const ABOUT = {
  pregnancy: 'your pregnancy',
  breastfeeding: 'your breastfeeding',
  g6pd: 'your G6PD status',
  condition: 'your health condition',
  allergy: 'your allergy',
  duplicate: 'the other medicines you take',
} as const;

/** Lines added to a warning when the medicine was prescribed. The level never changes. */
export const PRESCRIBED_NOTES = {
  knew: 'Your doctor knew about this when prescribing it.',
  didNotKnow: 'Your doctor did not know about this. Tell them before you take it.',
  unsure: 'Prescribed for you. Make sure the doctor who prescribed it knew about this.',
} as const;

/** A message made of fixed sentences, so each one can be translated ahead of time. */
const said = (parts: string[]) => ({ message: parts.join(' '), parts });

export const CHECK_LABELS: Record<CheckKind, string> = {
  'g6pd-pregnancy': 'G6PD and pregnancy',
  'self-medication': 'Self-medication and your profile',
  duplicate: 'Same ingredient twice',
};

function ruleApplies(rule: SafetyRule, p: Profile): boolean {
  const f = rule.factor;
  switch (f.type) {
    case 'g6pd':
      return p.g6pd === 'deficient' || G6PD_UNSURE.has(p.g6pd);
    case 'pregnancy':
      if (p.pregnancy !== 'pregnant') return false;
      // Trimester unknown: apply every pregnancy rule (the safer reading).
      return p.trimester == null || f.trimesters.includes(p.trimester);
    case 'breastfeeding':
      return p.pregnancy === 'breastfeeding';
    case 'condition':
      return p.conditions.includes(f.condition);
    case 'allergy':
      return p.allergies.includes(f.group);
  }
}

function flagFromRule(rule: SafetyRule, p: Profile, med: Medicine): Flag {
  const f = rule.factor;
  const ingredientName = INGREDIENTS[rule.ingredient]?.name ?? rule.ingredient;
  if (f.type === 'g6pd' && p.g6pd !== 'deficient') {
    // Unknown status raises a question; it never counts as a confirmed deficiency.
    return {
      id: `${rule.id}:${med.id}`,
      check: 'g6pd-pregnancy',
      level: 'medium',
      title: FLAG_TITLES.g6pdUnsure,
      ...said([rule.message, G6PD_UNSURE_NOTE]),
      reason: `${rule.id}|g6pd-unknown`,
      ingredient: ingredientName,
      about: ABOUT.g6pd,
      detail: `${med.brand} · ${ingredientName}`,
    };
  }
  const titles: Record<SafetyRule['factor']['type'], string> = {
    g6pd: FLAG_TITLES.g6pd,
    pregnancy: FLAG_TITLES.pregnancy,
    breastfeeding: FLAG_TITLES.breastfeeding,
    condition: FLAG_TITLES.condition,
    allergy: FLAG_TITLES.allergy,
  };
  return {
    id: `${rule.id}:${med.id}`,
    check: f.type === 'g6pd' || f.type === 'pregnancy' || f.type === 'breastfeeding' ? 'g6pd-pregnancy' : 'self-medication',
    level: rule.level,
    title: titles[f.type],
    ...said([rule.message]),
    reason: rule.id,
    ingredient: ingredientName,
    about: ABOUT[f.type],
    detail: `${med.brand} · ${ingredientName}`,
  };
}

function otherAllergyFlags(p: Profile, med: Medicine): Flag[] {
  const typed = p.otherAllergies
    .toLowerCase()
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
  if (!typed.length) return [];
  return med.ingredients
    .filter((ing) => typed.some((t) => INGREDIENTS[ing]?.name.toLowerCase().includes(t)))
    .map((ing) => ({
      id: `allergy-typed-${ing}:${med.id}`,
      check: 'self-medication' as const,
      level: 'high' as const,
      title: 'Possible allergy',
      ...said(['This medicine contains an ingredient you listed as an allergy.']),
      reason: `allergy-typed|${ing}`,
      ingredient: INGREDIENTS[ing].name,
      about: ABOUT.allergy,
      detail: `${med.brand} · ${INGREDIENTS[ing].name}`,
    }));
}

function prescriptionFlag(med: Medicine, prescribed: boolean | null): Flag[] {
  if (prescribed !== false || med.prescriptionOnly !== true) return [];
  const isAntibiotic = med.ingredients.some((i) => INGREDIENTS[i]?.kind.includes('antibiotic'));
  return [
    {
      id: `rx-only:${med.id}`,
      check: 'self-medication',
      level: 'medium',
      title: FLAG_TITLES.rxOnly,
      ...said(
        isAntibiotic
          ? ['This is an antibiotic that usually needs a prescription.', 'Taking antibiotics without one can mean the wrong medicine or dose, and helps germs become resistant.']
          : ['This medicine usually needs a prescription, so a pharmacist or doctor should confirm it is right for you.'],
      ),
      reason: 'rx-only-not-prescribed',
      detail: med.brand,
    },
  ];
}

function duplicateFlags(checked: Medicine[], current: Medicine[]): Flag[] {
  const flags: Flag[] = [];
  const seen = new Set<string>();
  const pool = [...checked.map((m) => ({ m, checked: true })), ...current.map((m) => ({ m, checked: false }))];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i];
      const b = pool[j];
      if (!a.checked && !b.checked) continue; // both already taken: not this check's job
      if (a.m.id === b.m.id && a.checked === b.checked) continue;
      const shared = a.m.ingredients.filter((x) => b.m.ingredients.includes(x));
      for (const ing of shared) {
        const key = [ing, ...[a.m.id, b.m.id].sort()].join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const name = ingredientName(a.m, ing);
        const same = a.m.id === b.m.id;
        flags.push({
          id: `dup-${key}`,
          check: 'duplicate',
          level: 'medium',
          title: same ? FLAG_TITLES.alreadyTaking : FLAG_TITLES.duplicate,
          ...said(
            same
              ? ['You listed this medicine as one you already take.', 'Taking extra may give you too much of it.']
              : ['These products contain the same ingredient.', 'Taking both may give you too much.'],
          ),
          reason: `duplicate|${ing}`,
          ingredient: name,
          about: ABOUT.duplicate,
          detail: same ? `${a.m.brand} · ${name}` : `${a.m.brand} + ${b.m.brand} · ${name}`,
        });
      }
    }
  }
  return flags;
}

/** Marks warnings on a prescribed medicine with what the user told us about the prescriber. */
function withPrescription(flags: Flag[], prescribed: boolean | null, prescriberKnew: boolean | null): Flag[] {
  if (prescribed !== true) return flags;
  return flags.map((f) => {
    if (!f.about) return f;
    if (prescriberKnew === true) return { ...f, note: PRESCRIBED_NOTES.knew, discussed: true };
    if (prescriberKnew === false) return { ...f, note: PRESCRIBED_NOTES.didNotKnow };
    return { ...f, note: PRESCRIBED_NOTES.unsure };
  });
}

/** The profile points to ask about when a prescribed medicine raised warnings. */
export function prescriberTopics(r: Pick<CheckResult, 'flags' | 'prescribed'>): string[] {
  if (r.prescribed !== true) return [];
  return [...new Set(r.flags.map((f) => f.about).filter((a): a is string => !!a))];
}

export function runChecks(profile: Profile, medicineIds: string[], prescribed: boolean | null, prescriberKnew: boolean | null = null): CheckResult {
  const checked = medicineIds.map(medicineById).filter((m): m is Medicine => !!m);
  const current = profile.currentMedicines.map(medicineById).filter((m): m is Medicine => !!m);

  const flags: Flag[] = [];
  for (const med of checked) {
    for (const rule of ALL_RULES) {
      if (med.ingredients.includes(rule.ingredient) && ruleApplies(rule, profile)) {
        flags.push(flagFromRule(rule, profile, med));
      }
    }
    flags.push(...otherAllergyFlags(profile, med));
    flags.push(...prescriptionFlag(med, prescribed));
  }
  flags.push(...duplicateFlags(checked, current));

  // Highest risk first, so the most important message is read first.
  const unique = withPrescription(
    [...new Map(flags.map((f) => [f.id, f])).values()].sort((a, b) => RANK[b.level] - RANK[a.level]),
    prescribed,
    prescriberKnew,
  );

  // Ingredients MediTrust can name but has no verified rules for: never report "no concern" for these.
  const unassessed = [...new Set(checked.flatMap((m) => m.ingredients.filter((i) => !INGREDIENTS[i]?.assessed).map((i) => ingredientName(m, i))))];
  const unknownRxStatus = checked.filter((m) => m.prescriptionOnly === null).map((m) => m.brand);

  const kinds: CheckKind[] = ['g6pd-pregnancy', 'self-medication', 'duplicate'];
  return {
    medicineIds,
    prescribed,
    prescriberKnew: prescribed === true ? prescriberKnew : null,
    level: unique.length ? maxLevel(unique.map((f) => f.level)) : 'low',
    flags: unique,
    checksRun: kinds.map((kind) => ({ kind, label: CHECK_LABELS[kind], flagged: unique.some((f) => f.check === kind) })),
    unassessed,
    unknownRxStatus,
  };
}

/** What to show: a risk level, or "no verified information yet" when nothing was found but coverage is incomplete. */
export function displayLevel(r: Pick<CheckResult, 'level' | 'flags' | 'unassessed'>): DisplayLevel {
  if (!r.flags.length && (r.unassessed?.length ?? 0) > 0) return 'unverified';
  return r.level;
}
