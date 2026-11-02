import { describe, expect, it } from 'vitest';
import {
  SECTION_WEIGHTS,
  completenessScore,
  nextSection,
  publishBlockers,
  sectionScores,
  type ProfileSnapshot,
} from './completeness';

const empty: ProfileSnapshot = {
  displayName: 'Adaeze Okonkwo',
  kind: 'COUNSELLOR',
  headline: null,
  countryCode: 'NG',
  photoKey: null,
  about: null,
  approach: null,
  credentialsText: null,
  timelineCount: 0,
  terms: { SPECIALTY: 0, MODALITY: 0, POPULATION: 0, LANGUAGE: 0 },
  faithIntegration: null,
  selfReportedYears: null,
  showPlatformExperience: false,
  bookingMode: 'NONE',
  placesCount: 0,
  feeRangeText: null,
  externalBookingUrl: null,
  contactEmailPublic: null,
  socialLinksCount: 0,
};

const full: ProfileSnapshot = {
  ...empty,
  headline: 'Calm, practical support for anxiety',
  photoKey: 'profiles/1/photo.jpg',
  about: 'x'.repeat(150),
  approach: 'Collaborative',
  credentialsText: 'MSc',
  terms: { SPECIALTY: 2, MODALITY: 1, POPULATION: 1, LANGUAGE: 1 },
  selfReportedYears: 6,
  feeRangeText: '₦15,000–₦25,000',
  contactEmailPublic: 'hello@example.com',
};

describe('completeness (§6.7)', () => {
  it('weights add up to 100', () => {
    expect(Object.values(SECTION_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('scores a complete profile 100', () => {
    expect(completenessScore(full)).toBe(100);
  });

  it('gives identity 15 for the required fields and 5 for a photo', () => {
    expect(sectionScores({ ...full, photoKey: null }).identity).toBe(15);
    expect(sectionScores({ ...full, headline: '' }).identity).toBe(5);
  });

  it('counts about only from 150 characters', () => {
    expect(sectionScores({ ...full, about: 'x'.repeat(149) }).about).toBe(0);
    expect(sectionScores({ ...full, about: `  ${'x'.repeat(149)}  ` }).about).toBe(0);
  });

  it('counts qualifications from text or a timeline entry', () => {
    expect(sectionScores({ ...empty, timelineCount: 1 }).qualifications).toBe(15);
  });

  it('counts fees from DESK places or a fee range', () => {
    expect(sectionScores({ ...empty, bookingMode: 'DESK', placesCount: 1 }).fees).toBe(10);
    expect(sectionScores({ ...empty, bookingMode: 'DESK', placesCount: 0 }).fees).toBe(0);
  });

  it('counts contact from a booking route, an email or a social link', () => {
    expect(sectionScores({ ...empty, bookingMode: 'EXTERNAL', externalBookingUrl: 'https://x.test' }).contact).toBe(5);
    expect(sectionScores({ ...empty, bookingMode: 'EXTERNAL', externalBookingUrl: null }).contact).toBe(0);
    expect(sectionScores({ ...empty, socialLinksCount: 1 }).contact).toBe(5);
  });

  it('suggests the incomplete section worth the most, earliest on ties', () => {
    expect(nextSection(empty)).toBe('identity'); // 20 missing
    expect(nextSection({ ...empty, headline: 'h', photoKey: 'p' })).toBe('about'); // 15, before qualifications
    expect(nextSection(full)).toBeNull();
  });
});

describe('publish requirements (§6.4)', () => {
  it('lists what is missing, in section order', () => {
    expect(publishBlockers(empty)).toEqual(['headline', 'about', 'specialties', 'languages']);
  });

  it('has nothing to block a complete profile', () => {
    expect(publishBlockers(full)).toEqual([]);
  });

  it('needs no photo, qualifications or fees to publish', () => {
    expect(publishBlockers({ ...full, photoKey: null, credentialsText: null, feeRangeText: null })).toEqual([]);
  });
});
