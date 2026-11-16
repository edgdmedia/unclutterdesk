/**
 * Fixture data for the accessibility run (spec §6.4/§6.5): one published
 * profile for every layout × palette combination, so a colour-contrast or
 * structure regression in any of the twenty combinations fails CI.
 *
 * The shapes here are the public DTO the API returns
 * (apps/api public-profile.service.ts). Nothing is fetched from a real API.
 */

export const PALETTES = ['calm', 'warm', 'crisp', 'earth', 'night'];
export const LAYOUTS = ['classic', 'editorial', 'compact', 'split'];

/** Every handle the run visits: `<layout>-<palette>`. */
export const HANDLES = LAYOUTS.flatMap((layout) => PALETTES.map((palette) => `${layout}-${palette}`));

function profile(handle, layoutKey, themeKey) {
  return {
    handle,
    displayName: 'Adaeze Okonkwo',
    kind: 'COUNSELLOR',
    pronouns: 'she/her',
    photoUrl: null,
    previewImageUrl: null,
    headline: 'Calm, practical support for anxiety and life changes',
    about:
      'I work with adults who feel stuck, overwhelmed or unsure of the next step. Together we make sense of what is happening and build something you can use between sessions.\n\nSessions are online or in person in Lagos.',
    approach:
      'I draw on cognitive behavioural therapy and acceptance and commitment therapy, and I keep the work collaborative: you set the goals, I bring the structure.',
    credentialsText: 'MSc Counselling Psychology\nMember, Nigerian Psychological Association',
    supervisedBy: null,
    city: 'Lagos',
    countryCode: 'NG',
    offersOnline: true,
    offersInPerson: true,
    acceptingClients: true,
    faithIntegration: null,
    yearsInPractice: 8,
    feeRangeText: '₦25,000 – ₦35,000 per session',
    bookingMode: 'NONE',
    externalBookingUrl: null,
    deskBookingUrl: null,
    contactEmail: 'hello@example.test',
    socialLinks: [
      { platform: 'website', label: 'Website', url: 'https://example.test' },
      { platform: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/example' },
    ],
    themeKey,
    brandColor: null,
    layoutKey,
    specialties: [
      { key: 'anxiety', label: 'Anxiety', primary: true },
      { key: 'depression', label: 'Depression', primary: true },
      { key: 'life-transitions', label: 'Life transitions', primary: false },
    ],
    modalities: [
      { key: 'cbt', label: 'Cognitive behavioural therapy' },
      { key: 'act', label: 'Acceptance and commitment therapy' },
    ],
    populations: [
      { key: 'adults', label: 'Adults' },
      { key: 'young-adults', label: 'Young adults' },
    ],
    languages: [
      { key: 'english', label: 'English' },
      { key: 'yoruba', label: 'Yoruba' },
    ],
    timeline: [
      { type: 'EDUCATION', title: 'MSc Counselling Psychology', organisation: 'University of Lagos', startYear: 2014, endYear: 2016, description: null },
      { type: 'PRACTICE', title: 'Counsellor', organisation: 'Private practice', startYear: 2018, endYear: null, description: 'Individual therapy for adults.' },
    ],
    publishedAt: '2026-01-15T09:00:00.000Z',
    updatedAt: '2026-11-01T09:00:00.000Z',
  };
}

const BY_HANDLE = new Map(
  LAYOUTS.flatMap((layout) => PALETTES.map((palette) => {
    const handle = `${layout}-${palette}`;
    return [handle, profile(handle, layout, palette)];
  })),
);

export function profileFor(handle) {
  return BY_HANDLE.get(handle) ?? null;
}

export function sitemap() {
  return HANDLES.map((handle) => ({ handle, updatedAt: '2026-11-01T09:00:00.000Z' }));
}