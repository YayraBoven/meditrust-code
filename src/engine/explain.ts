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

export function flagSentence(flag: Flag): string {
  return flag.message;
}

/** The single message a user (or pharmacist) reads. Always ends with the referral. */
export function composeWarning(result: CheckResult, firstName?: string): string {
  const name = firstName?.trim() ? `${firstName.trim()}, ` : '';
  if (!result.flags.length) {
    if (displayLevel(result) === 'unverified') {
      const list = (result.unassessed ?? []).join(', ');
      return `${name}we identified this medicine (${list}), but MediTrust does not yet have verified safety information for it, so we cannot say whether it suits you. ${REFERRAL}`;
    }
    return `${name}we did not find a concern in MediTrust's checks. If you are unsure, ask a pharmacist.`;
  }
  const top = result.flags[0];
  const more = result.flags.length > 1 ? ` We also found ${result.flags.length - 1} other point${result.flags.length > 2 ? 's' : ''} to discuss.` : '';
  return `${name}${top.message}${more} Do not start or stop any medicine on your own. ${REFERRAL}`;
}

const BANNED = [/\bstop taking\b/i, /\bit is safe\b/i, /\bsafe to take\b/i, /(?<!not a )\bdiagnos(e|is)\b/i, /\binstead take\b/i, /\bswitch to\b/i, /\byou have g6pd deficiency\b/i];

/** Safety filter for any generated text. Must also contain a referral to a professional. */
export function passesSafetyFilter(text: string): boolean {
  if (BANNED.some((re) => re.test(text))) return false;
  return /pharmacist|doctor/i.test(text);
}
