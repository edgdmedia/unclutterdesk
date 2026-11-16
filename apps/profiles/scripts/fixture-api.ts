/**
 * Fixture API server for accessibility testing.
 * Serves fake profile data without hitting the real API.
 */
import type { PublicProfile } from '../src/lib/profiles';

const THEMES = ['calm', 'warm', 'crisp', 'earth', 'night'] as const;
const LAYOUTS = ['classic', 'editorial', 'compact', 'split'] as const;

function createFixtureProfile(handle: string, themeKey: string, layoutKey: string): PublicProfile {
  return {
    handle,
    displayName: `Dr. ${handle.charAt(0).toUpperCase() + handle.slice(1)} Therapist`,
    kind: 'PSYCHOLOGIST',
    pronouns: 'they/them',
    photoUrl: null,
    previewImageUrl: null,
    headline: 'Compassionate support for anxiety, depression, and life transitions',
    about: 'I am a licensed psychologist with over 10 years of experience helping adults navigate life\'s challenges. My approach is warm, collaborative, and evidence-based. I believe therapy is a journey we take together, and I\'m honored to walk alongside you.',
    approach: 'My therapeutic approach integrates cognitive-behavioral therapy (CBT) with mindfulness practices. Together, we\'ll explore patterns of thinking and behavior that may be holding you back, and develop practical strategies for change.',
    credentialsText: 'PhD in Clinical Psychology, University of Lagos\nLicensed Psychologist, Nigeria',
    supervisedBy: null,
    city: 'Lagos',
    countryCode: 'NG',
    offersOnline: true,
    offersInPerson: true,
    acceptingClients: true,
    faithIntegration: null,
    yearsInPractice: 12,
    feeRangeText: '₦25,000 - ₦35,000 per session',
    bookingMode: 'DESK',
    externalBookingUrl: null,
    deskBookingUrl: 'https://dr-therapist.unclutterdesk.com/book',
    contactEmail: `hello@${handle}.example.com`,
    socialLinks: [
      { platform: 'website', label: 'Website', url: `https://${handle}.example.com` },
      { platform: 'linkedin', label: 'LinkedIn', url: `https://linkedin.com/in/${handle}` },
    ],
    themeKey: themeKey as any,
    brandColor: null,
    layoutKey: layoutKey as any,
    specialties: [
      { key: 'anxiety', label: 'Anxiety', primary: true },
      { key: 'depression', label: 'Depression', primary: true },
      { key: 'trauma', label: 'Trauma & PTSD', primary: false },
    ],
    modalities: [
      { key: 'cbt', label: 'Cognitive Behavioral Therapy' },
      { key: 'mindfulness', label: 'Mindfulness' },
    ],
    populations: [
      { key: 'adults', label: 'Adults' },
      { key: 'young-adults', label: 'Young adults' },
    ],
    languages: [
      { key: 'en', label: 'English' },
      { key: 'yo', label: 'Yoruba' },
    ],
    timeline: [
      {
        type: 'EDUCATION',
        title: 'PhD in Clinical Psychology',
        organisation: 'University of Lagos',
        startYear: 2010,
        endYear: 2014,
        description: null,
      },
      {
        type: 'EXPERIENCE',
        title: 'Senior Psychologist',
        organisation: 'Mindful Wellness Clinic',
        startYear: 2018,
        endYear: null,
        description: 'Leading a team of therapists and providing individual therapy',
      },
    ],
    publishedAt: new Date('2024-01-15').toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Generate profiles for all layout × theme combinations
const fixtureProfiles: Record<string, PublicProfile> = {};
for (const layout of LAYOUTS) {
  for (const theme of THEMES) {
    const handle = `${layout}-${theme}`;
    fixtureProfiles[handle] = createFixtureProfile(handle, theme, layout);
  }
}

export function getFixtureProfile(handle: string): PublicProfile | null {
  return fixtureProfiles[handle] ?? null;
}

export function getAllFixtureHandles(): string[] {
  return Object.keys(fixtureProfiles);
}
