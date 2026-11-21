import type { CheckResult, DisplayLevel, Flag } from '../data/types';
import { displayLevel } from './checks';

/**
 * Explanation layer. In the prototype the wording comes from reviewed templates.
 * An LLM can later rephrase the same rule result; whatever it writes must pass
 * `passesSafetyFilter`, otherwise the template below is used unchanged.
 */

export const REFERRAL = 'Please check with a pharmacist or doctor before you take it.';

export const LEVEL_COPY: Record<DisplayLevel, { label: string; headline: string; lead: string }> = {
  high: {
    label: 'High risk',
    headline: 'Please check before you take this',
    lead: 'We found something important about this medicine and your health profile.',
  },
  medium: {
    label: 'Medium risk',
    headline: 'Possible risk: check with a pharmacist',
    lead: 'We found something a pharmacist should look at with you.',
  },
  unverified: {
    label: 'No verified information',
    headline: 'We found it, but cannot check it yet',
    lead: 'MediTrust identified this medicine but does not yet have verified safety rules for it.',
  },
  low: {
    label: 'Low risk',
    headline: 'No issues found in our checks',
    lead: 'MediTrust did not find a concern in its three checks. This does not mean the medicine is right for you in every case.',
  },
};

/** Headline and lead when a prescribed medicine raised warnings about the profile. */
export const PRESCRIBED_COPY = {
  confirm: {
    headline: 'Prescribed for you: one thing to confirm',
    lead: 'You told us a doctor prescribed this. Something in your profile should be confirmed with them.',
  },
  discussed: {
    headline: 'Prescribed for you: discussed with your doctor',
    lead: 'You told us your doctor knew about this. MediTrust still shows it so your pharmacist can see it too.',
  },
} as const;

export const PRESCRIBED_REFERRAL = {
  knew: "Follow your doctor's instructions, and do not stop a prescribed medicine without talking to them. The pharmacist can confirm the dose when you collect it.",
  didNotKnow: 'Tell the doctor who prescribed it, or the pharmacist, before you take it. Do not stop a prescribed medicine without talking to your doctor.',
  unsure: 'If you are not sure your doctor knew, tell them or the pharmacist before you take it. Do not stop a prescribed medicine without talking to your doctor.',
} as const;

/** Which prescribed wording applies, if any. */
export function prescribedMode(result: Pick<CheckResult, 'flags' | 'prescribed' | 'prescriberKnew'>): 'knew' | 'didNotKnow' | 'unsure' | null {
  if (result.prescribed !== true || !result.flags.some((f) => f.about)) return null;
  if (result.prescriberKnew === true) return 'knew';
  if (result.prescriberKnew === false) return 'didNotKnow';
  return 'unsure';
}

/** Headline and lead for a result, aware of prescriptions. */
export function resultCopy(result: CheckResult): { label: string; headline: string; lead: string } {
  const base = LEVEL_COPY[displayLevel(result)];
  const mode = prescribedMode(result);
  if (!mode || result.level === 'low') return base;
  const p = mode === 'knew' ? PRESCRIBED_COPY.discussed : PRESCRIBED_COPY.confirm;
  return { ...base, headline: p.headline, lead: p.lead };
}

type T = (english: string) => string;
const same: T = (x) => x;

/** A flag's message in the reader's language (each fixed sentence translated). */
export function flagText(flag: Flag, t: T = same): string {
  return (flag.parts ?? [flag.message]).map(t).join(' ');
}

export const NOT_SAFE_NOTE = 'Do not start or stop any medicine on your own.';
export const MORE_POINTS = 'We also found other points to discuss.';
export const NO_CONCERN = "We did not find a concern in MediTrust's checks. If you are unsure, ask a pharmacist.";
export const UNVERIFIED_NOTE = 'We identified this medicine, but MediTrust does not yet have verified safety information for it, so we cannot say whether it suits you.';

/** The single message a user (or pharmacist) reads. Always ends with the referral. */
export function composeWarning(result: CheckResult, firstName?: string, t: T = same): string {
  const name = firstName?.trim() ? `${firstName.trim()}, ` : '';
  if (!result.flags.length) {
    if (displayLevel(result) === 'unverified') {
      const list = (result.unassessed ?? []).join(', ');
      return `${name}${t(UNVERIFIED_NOTE)} (${list}) ${t(REFERRAL)}`;
    }
    return `${name}${t(NO_CONCERN)}`;
  }
  const top = flagText(result.flags[0], t);
  const more = result.flags.length > 1 ? ` ${t(MORE_POINTS)}` : '';
  const mode = prescribedMode(result);
  if (mode) return `${name}${top}${more} ${t(PRESCRIBED_REFERRAL[mode])}`;
  return `${name}${top}${more} ${t(NOT_SAFE_NOTE)} ${t(REFERRAL)}`;
}

const BANNED = [/\bstop taking\b/i, /\bit is safe\b/i, /\bsafe to take\b/i, /(?<!not a )\bdiagnos(e|is)\b/i, /\binstead take\b/i, /\bswitch to\b/i, /\byou have g6pd deficiency\b/i];

/** Safety filter for any generated text. Must also contain a referral to a professional. */
export function passesSafetyFilter(text: string): boolean {
  if (BANNED.some((re) => re.test(text))) return false;
  return /pharmacist|doctor/i.test(text);
}
