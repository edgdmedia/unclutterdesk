/**
 * Profile sections, publish requirements and the completeness score
 * (spec §6.4, §6.7). Pure functions over a profile snapshot, so the API
 * (which stores the score) and the editor (which shows it) can't disagree.
 */

export type SectionKey =
  | 'identity'
  | 'about'
  | 'qualifications'
  | 'specialties'
  | 'approach'
  | 'population'
  | 'languages'
  | 'experience'
  | 'fees'
  | 'contact';

/** §6.4 order. The editor and the public page both follow it. */
export const SECTION_ORDER: readonly SectionKey[] = [
  'identity',
  'about',
  'qualifications',
  'specialties',
  'approach',
  'population',
  'languages',
  'experience',
  'fees',
  'contact',
];

/** §6.7 weights. "Who I work with" carries no weight. Sum: 100. */
export const SECTION_WEIGHTS: Record<SectionKey, number> = {
  identity: 20,
  about: 15,
  qualifications: 15,
  specialties: 10,
  approach: 10,
  population: 0,
  languages: 5,
  experience: 10,
  fees: 10,
  contact: 5,
};

export const ABOUT_MIN_TO_PUBLISH = 150;

export interface ProfileSnapshot {
  displayName: string | null;
  kind: string | null;
  headline: string | null;
  countryCode: string | null;
  photoKey: string | null;
  about: string | null;
  approach: string | null;
  credentialsText: string | null;
  timelineCount: number;
  /** Counts of selected taxonomy terms by kind. */
  terms: { SPECIALTY: number; MODALITY: number; POPULATION: number; LANGUAGE: number };
  faithIntegration: string | null;
  selfReportedYears: number | null;
  showPlatformExperience: boolean;
  bookingMode: 'NONE' | 'DESK' | 'EXTERNAL';
  placesCount: number;
  feeRangeText: string | null;
  externalBookingUrl: string | null;
  contactEmailPublic: string | null;
  socialLinksCount: number;
}

const has = (text: string | null | undefined) => Boolean(text && text.trim());

/** What each section earns, out of its weight. Identity: 15 for the required fields, 5 for a photo. */
export function sectionScores(p: ProfileSnapshot): Record<SectionKey, number> {
  const identityCore = has(p.displayName) && has(p.kind) && has(p.headline) && has(p.countryCode);
  return {
    identity: (identityCore ? 15 : 0) + (p.photoKey ? 5 : 0),
    about: (p.about?.trim().length ?? 0) >= ABOUT_MIN_TO_PUBLISH ? 15 : 0,
    qualifications: has(p.credentialsText) || p.timelineCount > 0 ? 15 : 0,
    specialties: p.terms.SPECIALTY > 0 ? 10 : 0,
    approach: has(p.approach) || p.terms.MODALITY > 0 ? 10 : 0,
    population: 0,
    languages: p.terms.LANGUAGE > 0 ? 5 : 0,
    experience: p.selfReportedYears !== null || p.showPlatformExperience ? 10 : 0,
    fees: (p.bookingMode === 'DESK' && p.placesCount > 0) || has(p.feeRangeText) ? 10 : 0,
    contact:
      (p.bookingMode === 'DESK' && p.placesCount > 0) ||
      (p.bookingMode === 'EXTERNAL' && has(p.externalBookingUrl)) ||
      has(p.contactEmailPublic) ||
      p.socialLinksCount > 0
        ? 5
        : 0,
  };
}

export function completenessScore(p: ProfileSnapshot): number {
  return Object.values(sectionScores(p)).reduce((a, b) => a + b, 0);
}

export type PublishBlocker = 'displayName' | 'kind' | 'headline' | 'countryCode' | 'about' | 'specialties' | 'languages';

export const PUBLISH_BLOCKER_MESSAGES: Record<PublishBlocker, string> = {
  displayName: 'Add your name',
  kind: 'Choose what kind of practitioner you are',
  headline: 'Add a one-line headline',
  countryCode: 'Choose your country',
  about: `Write at least ${ABOUT_MIN_TO_PUBLISH} characters about yourself`,
  specialties: 'Choose at least one specialty',
  languages: 'Choose at least one language',
};

/** §6.4 "Required to publish", in section order. Empty means it can be published. */
export function publishBlockers(p: ProfileSnapshot): PublishBlocker[] {
  const out: PublishBlocker[] = [];
  if (!has(p.displayName)) out.push('displayName');
  if (!has(p.kind)) out.push('kind');
  if (!has(p.headline)) out.push('headline');
  if (!has(p.countryCode)) out.push('countryCode');
  if ((p.about?.trim().length ?? 0) < ABOUT_MIN_TO_PUBLISH) out.push('about');
  if (p.terms.SPECIALTY < 1) out.push('specialties');
  if (p.terms.LANGUAGE < 1) out.push('languages');
  return out;
}

/** The most useful section to work on next: the incomplete one worth the most, earliest on ties. */
export function nextSection(p: ProfileSnapshot): SectionKey | null {
  const scores = sectionScores(p);
  let best: SectionKey | null = null;
  for (const key of SECTION_ORDER) {
    const missing = SECTION_WEIGHTS[key] - scores[key];
    if (missing <= 0) continue;
    if (!best || missing > SECTION_WEIGHTS[best] - scores[best]) best = key;
  }
  return best;
}
