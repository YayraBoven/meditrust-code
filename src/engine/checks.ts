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
      title: 'Possible G6PD concern',
      message: `${rule.message} You are not sure of your G6PD status, so this is a possible risk to discuss, not a diagnosis. Ask a pharmacist whether you should have a G6PD test first.`,
      reason: `${rule.id}|g6pd-unknown`,
      ingredient: ingredientName,
    };
  }
  const titles: Record<SafetyRule['factor']['type'], string> = {
    g6pd: 'G6PD risk',
    pregnancy: 'Pregnancy concern',
    breastfeeding: 'Breastfeeding concern',
    condition: 'Concern with your health condition',
    allergy: 'Possible allergy',
  };
  return {
    id: `${rule.id}:${med.id}`,
    check: f.type === 'g6pd' || f.type === 'pregnancy' || f.type === 'breastfeeding' ? 'g6pd-pregnancy' : 'self-medication',
    level: rule.level,
    title: titles[f.type],
    message: rule.message,
    reason: rule.id,
    ingredient: ingredientName,
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
      message: `This medicine contains ${INGREDIENTS[ing].name}, which you listed as an allergy.`,
      reason: `allergy-typed|${ing}`,
      ingredient: INGREDIENTS[ing].name,
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
      title: 'Usually needs a prescription',
      message: isAntibiotic
        ? `${med.generic} is an antibiotic that usually needs a prescription. Taking antibiotics without one can mean the wrong medicine or dose, and helps germs become resistant.`
        : `${med.generic} usually needs a prescription, so a pharmacist or doctor should confirm it is right for you.`,
      reason: 'rx-only-not-prescribed',
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
          title: same ? 'You already take this medicine' : 'Same ingredient twice',
          message: same
            ? `You listed ${a.m.brand} as a medicine you already take. Taking extra may give you too much ${name}.`
            : `${a.m.brand} and ${b.m.brand} both contain ${name}. Taking both may give you too much.`,
          reason: `duplicate|${ing}`,
          ingredient: name,
        });
      }
    }
  }
  return flags;
}

export function runChecks(profile: Profile, medicineIds: string[], prescribed: boolean | null): CheckResult {
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
  const unique = [...new Map(flags.map((f) => [f.id, f])).values()].sort((a, b) => RANK[b.level] - RANK[a.level]);

  // Ingredients MediTrust can name but has no verified rules for: never report "no concern" for these.
  const unassessed = [...new Set(checked.flatMap((m) => m.ingredients.filter((i) => !INGREDIENTS[i]?.assessed).map((i) => ingredientName(m, i))))];
  const unknownRxStatus = checked.filter((m) => m.prescriptionOnly === null).map((m) => m.brand);

  const kinds: CheckKind[] = ['g6pd-pregnancy', 'self-medication', 'duplicate'];
  return {
    medicineIds,
    prescribed,
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
