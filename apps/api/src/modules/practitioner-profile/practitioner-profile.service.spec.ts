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
    practitionerHandleHistory: {
      findUnique: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockReturnValue('deleteHistory'),
      create: vi.fn().mockReturnValue('createHistory'),
    },
    practitionerTaxonomy: {
      deleteMany: vi.fn().mockReturnValue('deleteTaxonomy'),
      createMany: vi.fn().mockReturnValue('createTaxonomy'),
    },
    consultTherapistProfile: { findFirst: vi.fn() },
    taxonomyTerm: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  };
  const jobs: any = { enqueue: vi.fn().mockResolvedValue({ id: 1n }) };
  return { service: new PractitionerProfileService(prisma, jobs), prisma, jobs };
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
function ownProfile(prisma: any, profile: Record<string, unknown> = { id: 1n, handle: 'adaeze', userId: ME }) {
  prisma.practitionerProfile.findUnique.mockImplementation(async ({ where }: any) =>
    where.userId === ME || where.handle === profile.handle ? profile : null,
  );
}

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
      ownProfile(prisma, { id: 1n, handle: 'adaeze', userId: ME });

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
      ownProfile(prisma, { id: 1n, handle: 'adaeze', userId: ME });
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
});
