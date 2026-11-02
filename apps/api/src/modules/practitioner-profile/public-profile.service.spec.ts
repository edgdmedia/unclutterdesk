import { GoneException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PublicProfileService } from './public-profile.service';

const ROW = {
  id: 1n,
  userId: 7n,
  handle: 'adaeze',
  status: 'PUBLISHED',
  kind: 'COUNSELLOR',
  templateKey: 'private-practice-counsellor',
  themeKey: 'warm',
  displayName: 'Adaeze Okonkwo',
  pronouns: 'she/her',
  photoKey: 'profiles/1/photo-ab.jpg',
  previewImageKey: null,
  headline: 'Calm support',
  about: '<script>alert(1)</script> I help adults.',
  approach: 'CBT',
  introVideoKey: 'private/video.mp4',
  credentialsText: 'MSc',
  city: 'Lagos',
  countryCode: 'NG',
  offersOnline: true,
  offersInPerson: false,
  acceptingClients: true,
  faithIntegration: null,
  supervisedBy: null,
  showPlatformExperience: true,
  selfReportedYears: 6,
  selfReportedClientsBucket: '50-100',
  feeRangeText: '₦20,000',
  bookingMode: 'NONE',
  externalBookingUrl: 'https://cal.example/ada',
  contactEmailPublic: 'hello@ada.example',
  socialLinks: { website: 'https://ada.example', instagram: 'javascript:alert(1)', unknown: 'https://x.example' },
  completenessScore: 80,
  publishedAt: new Date('2026-11-01T10:00:00Z'),
  lastActiveAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date('2026-11-02T10:00:00Z'),
  taxonomy: [
    { isPrimary: false, term: { kind: 'SPECIALTY', key: 'anxiety', label: 'Anxiety', sortOrder: 10, isActive: true } },
    { isPrimary: true, term: { kind: 'SPECIALTY', key: 'grief', label: 'Grief & loss', sortOrder: 40, isActive: true } },
    { isPrimary: false, term: { kind: 'SPECIALTY', key: 'retired', label: 'Retired term', sortOrder: 5, isActive: false } },
    { isPrimary: false, term: { kind: 'LANGUAGE', key: 'yoruba', label: 'Yoruba', sortOrder: 20, isActive: true } },
  ],
  timeline: [{ id: 9n, profileId: 1n, type: 'EDUCATION', title: 'MSc', organisation: 'UNILAG', startYear: 2014, endYear: 2016, description: null, sortOrder: 0 }],
};

function setup(row: Record<string, unknown> | null = ROW, moved: unknown = null) {
  const prisma: any = {
    practitionerProfile: { findUnique: vi.fn().mockResolvedValue(row), findMany: vi.fn().mockResolvedValue([]) },
    practitionerHandleHistory: { findUnique: vi.fn().mockResolvedValue(moved) },
  };
  const storage: any = { configured: vi.fn().mockReturnValue(true), publicUrl: (k: string) => `https://media.example.test/${k}` };
  return { service: new PublicProfileService(prisma, storage), prisma };
}

describe('public profile reads (§6.11)', () => {
  it('returns exactly the allow-listed fields of a published profile', async () => {
    const { service } = setup();
    const result = (await service.byHandle('adaeze')) as any;
    expect(Object.keys(result.profile).sort()).toEqual(
      [
        'about', 'acceptingClients', 'approach', 'bookingMode', 'city', 'contactEmail', 'countryCode', 'credentialsText',
        'displayName', 'externalBookingUrl', 'faithIntegration', 'feeRangeText', 'handle', 'headline', 'kind', 'languages',
        'modalities', 'offersInPerson', 'offersOnline', 'photoUrl', 'populations', 'previewImageUrl', 'pronouns', 'publishedAt',
        'socialLinks', 'specialties', 'supervisedBy', 'themeKey', 'timeline', 'updatedAt', 'yearsInPractice',
      ].sort(),
    );
    const text = JSON.stringify(result);
    for (const secret of ['userId', '"id"', 'photoKey', 'introVideoKey', 'private/video', 'selfReportedClientsBucket', 'completenessScore', 'templateKey']) {
      expect(text).not.toContain(secret);
    }
  });

  it('passes therapist text through unchanged: rendering it safely is the page’s job (§4.3)', async () => {
    const { service } = setup();
    expect(((await service.byHandle('adaeze')) as any).profile.about).toBe('<script>alert(1)</script> I help adults.');
  });

  it('links the photo at the public media address', async () => {
    const { service } = setup();
    expect(((await service.byHandle('adaeze')) as any).profile.photoUrl).toBe('https://media.example.test/profiles/1/photo-ab.jpg');
  });

  it('keeps only known https social links', async () => {
    const { service } = setup();
    expect(((await service.byHandle('adaeze')) as any).profile.socialLinks).toEqual({ website: 'https://ada.example' });
  });

  it('shows the external booking link only in EXTERNAL mode', async () => {
    expect(((await setup().service.byHandle('adaeze')) as any).profile.externalBookingUrl).toBeNull();
    const external = setup({ ...ROW, bookingMode: 'EXTERNAL' });
    expect(((await external.service.byHandle('adaeze')) as any).profile.externalBookingUrl).toBe('https://cal.example/ada');
  });

  it('lists primary specialties first and drops retired terms', async () => {
    const { service } = setup();
    const p = ((await service.byHandle('adaeze')) as any).profile;
    expect(p.specialties).toEqual([
      { key: 'grief', label: 'Grief & loss', primary: true },
      { key: 'anxiety', label: 'Anxiety', primary: false },
    ]);
    expect(p.languages).toEqual([{ key: 'yoruba', label: 'Yoruba' }]);
  });

  it.each(['DRAFT', 'HIDDEN'])('answers 404 for a %s profile, without saying it exists', async (status) => {
    await expect(setup({ ...ROW, status }).service.byHandle('adaeze')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('answers 410 for a suspended profile', async () => {
    await expect(setup({ ...ROW, status: 'SUSPENDED' }).service.byHandle('adaeze')).rejects.toBeInstanceOf(GoneException);
  });

  it('points an old handle at the current one, only while that one is published', async () => {
    const moved = setup(null, { profile: { handle: 'adaeze-o', status: 'PUBLISHED' } });
    expect(await moved.service.byHandle('adaeze')).toEqual({ redirectTo: 'adaeze-o' });
    const hidden = setup(null, { profile: { handle: 'adaeze-o', status: 'HIDDEN' } });
    await expect(hidden.service.byHandle('adaeze')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a malformed handle without querying', async () => {
    const { service, prisma } = setup();
    await expect(service.byHandle('../etc')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.practitionerProfile.findUnique).not.toHaveBeenCalled();
  });

  it('builds the sitemap from published profiles only', async () => {
    const { service, prisma } = setup();
    await service.sitemap();
    expect(prisma.practitionerProfile.findMany.mock.calls[0][0].where).toEqual({ status: 'PUBLISHED' });
  });
});
