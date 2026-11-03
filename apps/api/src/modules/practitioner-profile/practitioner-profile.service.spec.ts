import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PractitionerProfileService } from './practitioner-profile.service';

const ME = 7n;
const OTHER = 8n;

function setup() {
  const prisma: any = {
    practitionerProfile: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({ data }: any) => ({ id: 1n, ...data })),
      update: vi.fn(async ({ data }: any) => ({ id: 1n, ...data })),
    },
    practitionerTimelineEntry: {
      deleteMany: vi.fn().mockReturnValue('deleteTimeline'),
      createMany: vi.fn().mockReturnValue('createTimeline'),
    },
    profileTemplate: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn() },
    practitionerHandleHistory: {
      findUnique: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockReturnValue('deleteHistory'),
      create: vi.fn().mockReturnValue('createHistory'),
    },
    practitionerTaxonomy: {
      deleteMany: vi.fn().mockReturnValue('deleteTaxonomy'),
      createMany: vi.fn().mockReturnValue('createTaxonomy'),
    },
    consultTherapistProfile: { findFirst: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    taxonomyTerm: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  };
  const jobs: any = { enqueue: vi.fn().mockResolvedValue({ id: 1n }), runNow: vi.fn().mockResolvedValue(undefined) };
  const storage: any = {
    configured: vi.fn().mockReturnValue(true),
    put: vi.fn(),
    remove: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
  };
  const entitlements: any = { assertProfile: vi.fn().mockResolvedValue(undefined), forProfile: vi.fn() };
  return {
    service: new PractitionerProfileService(prisma, jobs, storage, entitlements),
    prisma,
    jobs,
    storage,
    entitlements,
  };
}

const therapist = (over: Record<string, unknown> = {}) => ({
  profileId: 50n,
  tagline: 'Calm, practical support',
  credentials: 'MSc Counselling Psychology',
  yearsExperience: 6,
  specialty: 'Anxiety, grief',
  modalities: ['CBT', 'person-centred'],
  languages: ['Yoruba', 'english'],
  offersOnline: true,
  offersInPerson: true,
  profile: { firstName: 'Adaeze', lastName: 'Okonkwo' },
  ...over,
});

/** The profile lookups the service makes, answered as the user's own profile. */
const BLANK = {
  displayName: 'Adaeze Okonkwo',
  kind: 'COUNSELLOR',
  headline: null,
  countryCode: 'NG',
  photoKey: null,
  about: null,
  approach: null,
  credentialsText: null,
  faithIntegration: null,
  selfReportedYears: null,
  showPlatformExperience: false,
  bookingMode: 'NONE',
  feeRangeText: null,
  externalBookingUrl: null,
  contactEmailPublic: null,
  socialLinks: null,
  templateKey: null,
  status: 'DRAFT',
  publishedAt: null,
  taxonomy: [] as unknown[],
  _count: { timeline: 0, places: 0 },
};

function ownProfile(prisma: any, over: Record<string, unknown> = {}) {
  const profile = { id: 1n, handle: 'adaeze', userId: ME, ...BLANK, ...over };
  prisma.practitionerProfile.findUnique.mockImplementation(async ({ where }: any) =>
    where.userId === ME || where.handle === profile.handle ? profile : null,
  );
  return profile;
}

const READY = {
  headline: 'Calm, practical support',
  about: 'x'.repeat(160),
  taxonomy: [{ term: { kind: 'SPECIALTY' } }, { term: { kind: 'LANGUAGE' } }],
};

describe('PractitionerProfileService', () => {
  describe('handle availability', () => {
    it('reports format and reserved problems without touching the database', async () => {
      const { service, prisma } = setup();
      expect(await service.handleAvailability(ME, 'ab')).toMatchObject({ available: false, reason: 'format' });
      expect(await service.handleAvailability(ME, 'pricing')).toMatchObject({ available: false, reason: 'reserved' });
      expect(prisma.practitionerProfile.findUnique).not.toHaveBeenCalled();
    });

    it("refuses another person's handle, current or old", async () => {
      const { service, prisma } = setup();
      prisma.practitionerProfile.findUnique.mockResolvedValueOnce({ userId: OTHER });
      expect(await service.handleAvailability(ME, 'chente')).toMatchObject({ available: false, reason: 'taken' });

      prisma.practitionerHandleHistory.findUnique.mockResolvedValueOnce({ profile: { userId: OTHER } });
      expect(await service.handleAvailability(ME, 'old-chente')).toMatchObject({ available: false, reason: 'taken' });
    });

    it('lets you keep or return to your own handle', async () => {
      const { service, prisma } = setup();
      prisma.practitionerHandleHistory.findUnique.mockResolvedValueOnce({ profile: { userId: ME } });
      expect(await service.handleAvailability(ME, 'my-old-one')).toMatchObject({ available: true });
    });

    it('checks what was typed, lowercased and trimmed', async () => {
      const { service } = setup();
      expect(await service.handleAvailability(ME, '  Ada-O ')).toMatchObject({ handle: 'ada-o', available: true });
    });
  });

  describe('creating your profile', () => {
    it('starts a draft filled from your practice details (§6.1 back-fill)', async () => {
      const { service, prisma } = setup();
      prisma.consultTherapistProfile.findFirst.mockResolvedValue(therapist());
      prisma.taxonomyTerm.findMany.mockResolvedValue([
        { id: 1n, kind: 'SPECIALTY', key: 'anxiety', label: 'Anxiety' },
        { id: 2n, kind: 'SPECIALTY', key: 'grief', label: 'Grief & loss' },
        { id: 3n, kind: 'MODALITY', key: 'cbt', label: 'Cognitive behavioural therapy (CBT)' },
        { id: 4n, kind: 'MODALITY', key: 'person-centred', label: 'Person-centred' },
        { id: 5n, kind: 'LANGUAGE', key: 'yoruba', label: 'Yoruba' },
        { id: 6n, kind: 'LANGUAGE', key: 'english', label: 'English' },
      ]);

      await service.createOwn(ME, 50n, {});

      const data = prisma.practitionerProfile.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        userId: ME,
        handle: 'adaeze-okonkwo',
        kind: 'COUNSELLOR',
        displayName: 'Adaeze Okonkwo',
        headline: 'Calm, practical support',
        credentialsText: 'MSc Counselling Psychology',
        selfReportedYears: 6,
        offersOnline: true,
        offersInPerson: true,
      });
      expect(data.status).toBeUndefined(); // the column default: DRAFT
      expect(data.taxonomy.create.map((t: any) => t.termId).sort()).toEqual([1n, 2n, 3n, 4n, 5n, 6n]);
    });

    it('queues the practice photo to be copied to storage, once per profile', async () => {
      const { service, prisma, jobs } = setup();
      prisma.consultTherapistProfile.findFirst.mockResolvedValue(therapist());
      await service.createOwn(ME, 50n, {});
      expect(jobs.enqueue).toHaveBeenCalledWith(
        'profile.photo-backfill',
        { practitionerProfileId: '1', sourceProfileId: '50' },
        { dedupeKey: 'profile.photo-backfill:1' },
      );
    });

    it('reads the practice details only from your own therapist profile', async () => {
      const { service, prisma } = setup();
      prisma.consultTherapistProfile.findFirst.mockResolvedValue(therapist());
      await service.createOwn(ME, 50n, {});
      expect(prisma.consultTherapistProfile.findFirst.mock.calls[0][0].where).toEqual({
        profileId: 50n,
        profile: { userId: ME },
      });
    });

    it('refuses someone with no therapist profile', async () => {
      const { service, prisma } = setup();
      prisma.consultTherapistProfile.findFirst.mockResolvedValue(null);
      await expect(service.createOwn(ME, 50n, {})).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses a second profile', async () => {
      const { service, prisma } = setup();
      prisma.practitionerProfile.findUnique.mockResolvedValueOnce({ id: 1n });
      await expect(service.createOwn(ME, 50n, {})).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses a reserved handle', async () => {
      const { service, prisma } = setup();
      prisma.consultTherapistProfile.findFirst.mockResolvedValue(therapist());
      await expect(service.createOwn(ME, 50n, { handle: 'admin' })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.practitionerProfile.create).not.toHaveBeenCalled();
    });

    it('turns a lost race for the same handle into "taken", not a 500', async () => {
      const { service, prisma } = setup();
      prisma.consultTherapistProfile.findFirst.mockResolvedValue(therapist());
      prisma.practitionerProfile.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
      );
      await expect(service.createOwn(ME, 50n, { handle: 'chente' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updating your profile', () => {
    it('keeps plain text as typed, within its limit', async () => {
      const { service, prisma } = setup();
      ownProfile(prisma);
      await service.updateOwn(ME, { about: '  <b>Hello</b>\r\nthere  ' });
      expect(prisma.practitionerProfile.update.mock.calls[0][0]).toMatchObject({
        where: { userId: ME },
        data: { about: '<b>Hello</b>\nthere' },
      });
      await expect(service.updateOwn(ME, { headline: 'x'.repeat(121) })).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each(['http://example.com', 'javascript:alert(1)', 'https://user:pass@example.com', 'not a link'])(
      'refuses the social link %s (https only)',
      async (link) => {
        const { service, prisma } = setup();
        ownProfile(prisma);
        await expect(service.updateOwn(ME, { socialLinks: { website: link } })).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it('refuses fields that have their own flow', async () => {
      const { service, prisma } = setup();
      ownProfile(prisma);
      await service.updateOwn(ME, { status: 'PUBLISHED', handle: 'x', bookingMode: 'DESK', userId: OTHER } as any);
      expect(prisma.practitionerProfile.update.mock.calls[0][0].data).toEqual({});
    });

    it('says so when you have no profile yet', async () => {
      const { service } = setup();
      await expect(service.updateOwn(ME, { headline: 'Hi' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('changing your handle', () => {
    it('keeps the old handle in history and frees your return to it', async () => {
      const { service, prisma } = setup();
      ownProfile(prisma);

      await service.changeOwnHandle(ME, 'adaeze-o');

      expect(prisma.practitionerHandleHistory.create).toHaveBeenCalledWith({ data: { handle: 'adaeze', profileId: 1n } });
      expect(prisma.practitionerHandleHistory.deleteMany).toHaveBeenCalledWith({
        where: { handle: 'adaeze-o', profile: { userId: ME } },
      });
      expect(prisma.practitionerProfile.update).toHaveBeenCalledWith({ where: { userId: ME }, data: { handle: 'adaeze-o' } });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the handle is unchanged', async () => {
      const { service, prisma } = setup();
      ownProfile(prisma);
      await service.changeOwnHandle(ME, 'Adaeze');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('taxonomy', () => {
    const terms = [
      { id: 1n, kind: 'SPECIALTY' },
      { id: 2n, kind: 'SPECIALTY' },
      { id: 3n, kind: 'SPECIALTY' },
      { id: 4n, kind: 'SPECIALTY' },
      { id: 5n, kind: 'MODALITY' },
    ];

    it('replaces your terms in one transaction', async () => {
      const { service, prisma } = setup();
      ownProfile(prisma);
      prisma.taxonomyTerm.findMany.mockResolvedValue(terms.slice(0, 2));
      await service.setOwnTaxonomy(ME, [{ termId: '1', isPrimary: true }, { termId: '2' }]);
      expect(prisma.practitionerTaxonomy.createMany).toHaveBeenCalledWith({
        data: [
          { profileId: 1n, termId: 1n, isPrimary: true },
          { profileId: 1n, termId: 2n, isPrimary: false },
        ],
      });
      expect(prisma.$transaction).toHaveBeenCalledWith(['deleteTaxonomy', 'createTaxonomy']);
    });

    it('allows at most three primary specialties, and only specialties', async () => {
      const { service, prisma } = setup();
      ownProfile(prisma);
      prisma.taxonomyTerm.findMany.mockResolvedValue(terms.slice(0, 4));
      await expect(
        service.setOwnTaxonomy(ME, ['1', '2', '3', '4'].map((termId) => ({ termId, isPrimary: true }))),
      ).rejects.toBeInstanceOf(BadRequestException);

      prisma.taxonomyTerm.findMany.mockResolvedValue([terms[4]]);
      await expect(service.setOwnTaxonomy(ME, [{ termId: '5', isPrimary: true }])).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses inactive or unknown terms', async () => {
      const { service, prisma } = setup();
      ownProfile(prisma);
      prisma.taxonomyTerm.findMany.mockResolvedValue([]);
      await expect(service.setOwnTaxonomy(ME, [{ termId: '99' }])).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.setOwnTaxonomy(ME, [{ termId: 'x' }])).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('completeness on save (§6.7)', () => {
    it('stores the recomputed score after an update', async () => {
      const { service, prisma } = setup();
      ownProfile(prisma, READY);
      await service.updateOwn(ME, { headline: 'Calm, practical support' });
      const scoreWrite = prisma.practitionerProfile.update.mock.calls.find((c: any[]) => 'completenessScore' in c[0].data);
      // identity 15 (no photo) + about 15 + specialties 10 + languages 5
      expect(scoreWrite[0]).toEqual({ where: { userId: ME }, data: { completenessScore: 45 } });
    });
  });

  describe('appearance', () => {
    it('accepts a known theme and refuses others', async () => {
      const { service, prisma } = setup();
      ownProfile(prisma);
      await service.updateOwn(ME, { themeKey: 'warm' });
      expect(prisma.practitionerProfile.update.mock.calls[0][0].data).toEqual({ themeKey: 'warm' });
      await expect(service.updateOwn(ME, { themeKey: 'neon' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a known layout, separately from the palette, and refuses others', async () => {
      const { service, prisma } = setup();
      ownProfile(prisma);
      await service.updateOwn(ME, { layoutKey: 'editorial' });
      expect(prisma.practitionerProfile.update.mock.calls[0][0].data).toEqual({ layoutKey: 'editorial' });
      await expect(service.updateOwn(ME, { layoutKey: 'brutalist' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts only an active template', async () => {
      const { service, prisma } = setup();
      ownProfile(prisma);
      await expect(service.updateOwn(ME, { templateKey: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
      prisma.profileTemplate.findFirst.mockResolvedValue({ key: 'clinical-psychologist' });
      await service.updateOwn(ME, { templateKey: 'clinical-psychologist' });
      expect(prisma.profileTemplate.findFirst.mock.calls[1][0].where).toEqual({ key: 'clinical-psychologist', isActive: true });
    });
  });

  describe('publishing (§6.4)', () => {
    it('lists what is missing and refuses', async () => {
      const { service, prisma } = setup();
      ownProfile(prisma);
      await expect(service.publishOwn(ME)).rejects.toMatchObject({
        response: { blockers: [{ key: 'headline' }, { key: 'about' }, { key: 'specialties' }, { key: 'languages' }] },
      });
    });

    it('publishes a ready profile and keeps the first publish date', async () => {
      const { service, prisma } = setup();
      const first = new Date('2026-10-01T00:00:00Z');
      ownProfile(prisma, { ...READY, status: 'HIDDEN', publishedAt: first });
      await service.publishOwn(ME);
      expect(prisma.practitionerProfile.update).toHaveBeenCalledWith({ where: { userId: ME }, data: { status: 'PUBLISHED', publishedAt: first } });
    });

    it('warns, but publishes, when template text is unchanged (§6.6)', async () => {
      const { service, prisma } = setup();
      const example = 'People often come to me when something that used to feel manageable has started to feel heavy.';
      ownProfile(prisma, { ...READY, about: `${example} ${'x'.repeat(80)}`, templateKey: 'private-practice-counsellor' });
      prisma.profileTemplate.findUnique.mockResolvedValue({ sections: { sections: { about: { example } } } });
      const result = await service.publishOwn(ME);
      expect(result.warnings.unchangedTemplateText).toEqual(['about']);
    });

    it('never lets the owner publish or unpublish a suspended profile', async () => {
      const { service, prisma } = setup();
      ownProfile(prisma, { ...READY, status: 'SUSPENDED' });
      await expect(service.publishOwn(ME)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.unpublishOwn(ME)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('unpublishing hides a published profile and leaves a draft alone', async () => {
      const { service, prisma } = setup();
      ownProfile(prisma, { status: 'PUBLISHED' });
      await service.unpublishOwn(ME);
      expect(prisma.practitionerProfile.update).toHaveBeenCalledWith({ where: { userId: ME }, data: { status: 'HIDDEN' } });

      const draft = setup();
      ownProfile(draft.prisma, { status: 'DRAFT' });
      await draft.service.unpublishOwn(ME);
      expect(draft.prisma.practitionerProfile.update).not.toHaveBeenCalled();
    });
  });

  describe('timeline', () => {
    it('replaces the entries in order, in one transaction', async () => {
      const { service, prisma } = setup();
      ownProfile(prisma);
      await service.setOwnTimeline(ME, [
        { type: 'EDUCATION', title: 'MSc Counselling', organisation: 'University of Lagos', startYear: 2014, endYear: 2016 },
        { type: 'MEMBERSHIP', title: 'Counselling Association of Nigeria' },
      ]);
      const rows = prisma.practitionerTimelineEntry.createMany.mock.calls[0][0].data;
      expect(rows.map((r: any) => [r.sortOrder, r.title, r.profileId])).toEqual([
        [0, 'MSc Counselling', 1n],
        [1, 'Counselling Association of Nigeria', 1n],
      ]);
      expect(prisma.practitionerTimelineEntry.deleteMany).toHaveBeenCalledWith({ where: { profileId: 1n, profile: { userId: ME } } });
    });

    it.each([
      [{ type: 'HOBBY', title: 'x' }],
      [{ type: 'EDUCATION', title: '' }],
      [{ type: 'EDUCATION', title: 'x', startYear: 2016, endYear: 2014 }],
      [{ type: 'EDUCATION', title: 'x', startYear: 1900 }],
    ])('refuses %j', async (entry) => {
      const { service, prisma } = setup();
      ownProfile(prisma);
      await expect(service.setOwnTimeline(ME, [entry as any])).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('photo', () => {
    const PNG = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]).toString('base64')}`;

    it('uploads a real image under a new key and removes the old one', async () => {
      const { service, prisma, storage } = setup();
      ownProfile(prisma, { photoKey: 'profiles/1/photo-old.png' });
      await service.setOwnPhoto(ME, PNG);
      const key = storage.put.mock.calls[0][1];
      expect(key).toMatch(/^profiles\/1\/photo-[0-9a-f]{16}\.png$/);
      expect(prisma.practitionerProfile.update).toHaveBeenCalledWith({ where: { userId: ME }, data: { photoKey: key } });
      expect(storage.remove).toHaveBeenCalledWith('public', 'profiles/1/photo-old.png');
    });

    it('refuses something that is not a real image', async () => {
      const { service, prisma, storage } = setup();
      ownProfile(prisma);
      await expect(service.setOwnPhoto(ME, `data:image/png;base64,${Buffer.from('<svg>').toString('base64')}`)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('says plainly when storage is not set up', async () => {
      const { service, prisma, storage } = setup();
      ownProfile(prisma);
      storage.configured.mockReturnValue(false);
      await expect(service.setOwnPhoto(ME, PNG)).rejects.toThrow(/not available yet/);
    });
  });

  describe('one place to edit (merged profile page)', () => {
    it("copies the public profile's fields to every practice record of this person, and nothing else", async () => {
      const { service, prisma } = setup();
      ownProfile(prisma, {
        headline: 'Calm support',
        credentialsText: 'MSc',
        selfReportedYears: 6,
        taxonomy: [
          { isPrimary: true, term: { kind: 'SPECIALTY', label: 'Grief & loss', sortOrder: 40 } },
          { isPrimary: false, term: { kind: 'SPECIALTY', label: 'Anxiety', sortOrder: 10 } },
          { isPrimary: false, term: { kind: 'MODALITY', label: 'Person-centred', sortOrder: 60 } },
          { isPrimary: false, term: { kind: 'LANGUAGE', label: 'Yoruba', sortOrder: 20 } },
          { isPrimary: false, term: { kind: 'LANGUAGE', label: 'English', sortOrder: 10 } },
        ],
      });
      await service.updateOwn(ME, { headline: 'Calm support' });
      expect(prisma.consultTherapistProfile.updateMany).toHaveBeenCalledWith({
        where: { profile: { userId: ME } },
        data: {
          tagline: 'Calm support',
          credentials: 'MSc',
          yearsExperience: 6,
          specialty: 'Grief & loss',
          modalities: ['Person-centred'],
          languages: ['English', 'Yoruba'],
        },
      });
    });
  });

  describe('freshness (§6.12)', () => {
    const purges = (jobs: any) => jobs.enqueue.mock.calls.filter((c: any[]) => c[0] === 'profile.purge').map((c: any[]) => c[1].tags);

    it('purges a published profile after a change, and runs the purge at once', async () => {
      const { service, prisma, jobs } = setup();
      ownProfile(prisma, { status: 'PUBLISHED' });
      await service.updateOwn(ME, { headline: 'New' });
      expect(purges(jobs)).toEqual([['profile:adaeze']]);
      expect(jobs.runNow).toHaveBeenCalledWith(1n);
    });

    it('leaves drafts alone: nothing of theirs is cached', async () => {
      const { service, prisma, jobs } = setup();
      ownProfile(prisma, { status: 'DRAFT' });
      await service.updateOwn(ME, { headline: 'New' });
      expect(purges(jobs)).toEqual([]);
    });

    it('purges both handles and the sitemap when the handle changes', async () => {
      const { service, prisma, jobs } = setup();
      ownProfile(prisma, { status: 'PUBLISHED' });
      await service.changeOwnHandle(ME, 'adaeze-o');
      expect(purges(jobs)).toContainEqual(['profile:adaeze', 'profile:adaeze-o', 'sitemap']);
    });

    it('purges the page and the sitemap on publish and on unpublish', async () => {
      const ready = setup();
      ownProfile(ready.prisma, { ...READY, status: 'DRAFT' });
      await ready.service.publishOwn(ME);
      expect(purges(ready.jobs)).toContainEqual(['profile:adaeze', 'sitemap']);

      const live = setup();
      ownProfile(live.prisma, { status: 'PUBLISHED' });
      await live.service.unpublishOwn(ME);
      expect(purges(live.jobs)).toContainEqual(['profile:adaeze', 'sitemap']);
    });

    it('queues a new link-preview image (§6.3) on publish and on changes while published, never for drafts', async () => {
      const previews = (jobs: any) => jobs.enqueue.mock.calls.filter((c: any[]) => c[0] === 'profile.preview');
      const ready = setup();
      ownProfile(ready.prisma, { ...READY, status: 'DRAFT' });
      await ready.service.publishOwn(ME);
      expect(previews(ready.jobs)).toHaveLength(1);
      expect(previews(ready.jobs)[0][2]).toEqual({ dedupeKey: expect.stringMatching(/^profile\.preview:/) });

      const live = setup();
      ownProfile(live.prisma, { status: 'PUBLISHED' });
      await live.service.updateOwn(ME, { layoutKey: 'split' });
      expect(previews(live.jobs)).toHaveLength(1);

      const draft = setup();
      ownProfile(draft.prisma, { status: 'DRAFT' });
      await draft.service.updateOwn(ME, { headline: 'New' });
      expect(previews(draft.jobs)).toHaveLength(0);
    });
  });
});
