import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PersonFactsService } from './person-facts.service';
import { ConsultService, PERSON_FIELDS } from '../consult/consult.service';

/*
 * §6.17 contract: the booking page's therapist cards take facts about a
 * person from their profile, never from the practice record; the practice
 * record refuses to hold them.
 */
const legacy = {
  firstName: 'Ada', lastName: 'Obi', avatarUrl: 'https://old.example/a.png', tagline: 'OLD tagline', welcomeMessage: 'OLD welcome',
  credentials: 'OLD creds', yearsExperience: 1, specialty: 'OLD', modalities: ['OLD'], languages: ['OLD'], offersOnline: true, offersInPerson: false,
};

function prismaWith(profile: Record<string, unknown> | null) {
  return {
    practitionerProfile: { findMany: vi.fn(async () => (profile ? [profile] : [])) },
    consultTherapistProfile: {
      findMany: vi.fn(async () => [{ profileId: 70n, publicUsername: 'ada', isPublic: true, ...legacy, profile: { id: 70n, userId: 7n, firstName: 'Ada', lastName: 'Obi', email: 'a@x.test', avatarUrl: legacy.avatarUrl, status: 'active' } }]),
    },
  } as any;
}
const storage = { configured: () => true, publicUrl: (k: string) => `https://media.example/${k}` } as any;
const consult = (prisma: any) => new (ConsultService as any)(prisma, {}, {}, {}, {}, {}, {}, undefined, undefined, new PersonFactsService(prisma, storage)) as ConsultService;

describe('one home per fact (§6.17)', () => {
  it('booking page therapist cards read the profile, not the practice record', async () => {
    const prisma = prismaWith({
      userId: 7n, displayName: 'Dr Ada Obi', photoKey: 'p/ada.webp', headline: 'Calm support', about: 'I help adults with anxiety.',
      credentialsText: 'MSc Clinical Psychology', selfReportedYears: 6, offersOnline: true, offersInPerson: true,
      taxonomy: [
        { isPrimary: true, term: { kind: 'SPECIALTY', label: 'Anxiety', sortOrder: 10, isActive: true } },
        { isPrimary: false, term: { kind: 'LANGUAGE', label: 'Yoruba', sortOrder: 20, isActive: true } },
        { isPrimary: false, term: { kind: 'MODALITY', label: 'CBT', sortOrder: 5, isActive: false } },
      ],
    });
    const [card] = (await consult(prisma).getPublicTherapists(1n)) as any[];
    expect(card).toMatchObject({
      displayName: 'Dr Ada Obi', avatarUrl: 'https://media.example/p/ada.webp', tagline: 'Calm support', headline: 'Calm support',
      welcomeMessage: 'I help adults with anxiety.', about: 'I help adults with anxiety.', credentials: 'MSc Clinical Psychology',
      yearsExperience: 6, specialty: 'Anxiety', languages: ['Yoruba'], modalities: [],
    });
    expect(JSON.stringify(card)).not.toContain('OLD');
  });

  it('uses the practice record only for someone with no profile yet', async () => {
    const [card] = (await consult(prismaWith(null)).getPublicTherapists(1n)) as any[];
    expect(card).toMatchObject({ displayName: 'Ada Obi', tagline: 'OLD tagline', about: 'OLD welcome' });
  });

  it('the practice record refuses facts that belong on the profile', async () => {
    for (const field of PERSON_FIELDS) {
      const err = await consult(prismaWith(null)).updateTherapistProfile(1n, 70n, { [field]: field === 'yearsExperience' ? 3 : field.endsWith('s') ? ['x'] : 'x' } as any).catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse()).toMatchObject({ code: 'EDIT_IN_PROFILE', fields: [field] });
    }
  });
});
