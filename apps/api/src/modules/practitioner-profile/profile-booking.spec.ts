import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PractitionerProfileService } from './practitioner-profile.service';

const ME = 7n;
const THERAPIST = 70n;
const TENANT = 5n;

function setup({ services = 1, slots = 1, mode = 'NONE', places = [] as any[] } = {}) {
  const profile: any = { id: 1n, handle: 'folake', status: 'DRAFT', bookingMode: mode, externalBookingUrl: null, places };
  const tx: any = {
    practitionerPlace: { updateMany: vi.fn(), upsert: vi.fn() },
    practitionerProfile: { update: vi.fn() },
    tenant: { update: vi.fn() },
  };
  const prisma: any = {
    practitionerProfile: {
      findUnique: vi.fn(async () => profile),
      update: vi.fn(async ({ data }: any) => Object.assign(profile, data)),
    },
    consultTherapistProfile: { findUnique: vi.fn().mockResolvedValue({ profile: { tenantId: TENANT } }) },
    consultService: { count: vi.fn().mockResolvedValue(services) },
    consultAvailability: { count: vi.fn().mockResolvedValue(slots) },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
  };
  const service = new PractitionerProfileService(prisma, { enqueue: vi.fn() } as any, {} as any, {} as any);
  // Score and cache refresh are covered elsewhere; here they only need to run.
  vi.spyOn(service as any, 'refreshOwnScore').mockResolvedValue(undefined);
  vi.spyOn(service as any, 'purgeIfPublished').mockResolvedValue(undefined);
  return { service, prisma, tx, profile };
}

describe('booking mode (§6.9)', () => {
  it('reports whether booking through the practice is ready, and what is missing', async () => {
    const { service, prisma } = setup({ services: 0, slots: 0 });
    expect(await service.getBooking(ME, THERAPIST)).toMatchObject({ mode: 'NONE', deskReady: false, deskMissing: ['service', 'availability'], deskBookingUrl: null });
    expect(prisma.consultAvailability.count.mock.calls[0][0].where).toMatchObject({ tenantId: TENANT, providerProfileId: THERAPIST, isActive: true });
  });

  it('sets an external link, https only', async () => {
    const { service, profile } = setup();
    await service.setBooking(ME, THERAPIST, { mode: 'EXTERNAL', externalBookingUrl: 'https://cal.example/folake' });
    expect(profile).toMatchObject({ bookingMode: 'EXTERNAL', externalBookingUrl: 'https://cal.example/folake' });
    await expect(service.setBooking(ME, THERAPIST, { mode: 'EXTERNAL', externalBookingUrl: 'http://cal.example' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.setBooking(ME, THERAPIST, { mode: 'EXTERNAL' })).rejects.toThrow(/Add the link/);
  });

  it('refuses DESK until the practice can take bookings', async () => {
    const { service, tx } = setup({ slots: 0 });
    const err = await service.setBooking(ME, THERAPIST, { mode: 'DESK' }).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toMatchObject({ code: 'DESK_NOT_READY', missing: ['availability'] });
    expect(tx.practitionerProfile.update).not.toHaveBeenCalled();
  });

  it('DESK makes this practice the main place and switches on the practice view, in one transaction', async () => {
    const { service, tx, prisma } = setup();
    await service.setBooking(ME, THERAPIST, { mode: 'DESK' });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.practitionerPlace.updateMany).toHaveBeenCalledWith({ where: { profileId: 1n }, data: { isMain: false } });
    expect(tx.practitionerPlace.upsert.mock.calls[0][0]).toMatchObject({
      where: { profileId_therapistProfileId: { profileId: 1n, therapistProfileId: THERAPIST } },
      create: { profileId: 1n, tenantId: TENANT, therapistProfileId: THERAPIST, isMain: true },
    });
    expect(tx.practitionerProfile.update).toHaveBeenCalledWith({ where: { userId: ME }, data: { bookingMode: 'DESK' } });
    expect(tx.tenant.update).toHaveBeenCalledWith({ where: { id: TENANT }, data: { onboardingIntent: 'PRACTICE' } });
  });

  it('refuses an unknown mode, and needs a profile', async () => {
    const { service, prisma } = setup();
    await expect(service.setBooking(ME, THERAPIST, { mode: 'PHONE' })).rejects.toBeInstanceOf(BadRequestException);
    prisma.practitionerProfile.findUnique.mockResolvedValue(null);
    await expect(service.setBooking(ME, THERAPIST, { mode: 'NONE' })).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('slug rename when switching to DESK (§6.2)', () => {
    function setupWithSlug(currentSlug: string) {
      const base = setup();
      base.prisma.tenant = {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ id: TENANT, slug: currentSlug }) // current tenant lookup
          .mockResolvedValueOnce(null), // new slug not taken
        update: vi.fn(),
      };
      base.tx.tenant = {
        findUnique: vi.fn().mockResolvedValue({ slug: currentSlug }),
        update: vi.fn(),
      };
      base.tx.tenantSlugHistory = {
        upsert: vi.fn(),
      };
      return base;
    }

    it('accepts a valid new slug and stores the old one for redirects', async () => {
      const { service, tx } = setupWithSlug('folake');

      await service.setBooking(ME, THERAPIST, { mode: 'DESK', slug: 'folake-therapy' });

      expect(tx.tenantSlugHistory.upsert).toHaveBeenCalledWith({
        where: { slug: 'folake' },
        create: { slug: 'folake', tenantId: TENANT },
        update: { tenantId: TENANT, changedAt: expect.any(Date) },
      });
      expect(tx.tenant.update).toHaveBeenCalledWith({ where: { id: TENANT }, data: { slug: 'folake-therapy' } });
    });

    it('refuses a reserved slug', async () => {
      const { service } = setupWithSlug('folake');
      await expect(service.setBooking(ME, THERAPIST, { mode: 'DESK', slug: 'admin' })).rejects.toThrow(/reserved/);
    });

    it('refuses a slug taken by another tenant', async () => {
      const { service, prisma } = setupWithSlug('folake');
      prisma.tenant.findUnique
        .mockReset()
        .mockResolvedValueOnce({ id: TENANT, slug: 'folake' }) // current
        .mockResolvedValueOnce({ id: 99n }); // taken

      await expect(service.setBooking(ME, THERAPIST, { mode: 'DESK', slug: 'taken-slug' })).rejects.toThrow(/taken/);
    });

    it('skips the rename when the slug is unchanged', async () => {
      const { service, tx, prisma } = setupWithSlug('folake');
      prisma.tenant.findUnique
        .mockReset()
        .mockResolvedValueOnce({ id: TENANT, slug: 'folake' }); // current

      await service.setBooking(ME, THERAPIST, { mode: 'DESK', slug: 'folake' });

      expect(tx.tenantSlugHistory.upsert).not.toHaveBeenCalled();
    });

    it('validates the slug format', async () => {
      const { service, prisma } = setupWithSlug('folake');
      prisma.tenant.findUnique
        .mockReset()
        .mockResolvedValue({ id: TENANT, slug: 'folake' });

      // Special characters fail the format check.
      await expect(service.setBooking(ME, THERAPIST, { mode: 'DESK', slug: 'has space' })).rejects.toThrow(/lowercase/);
      await expect(service.setBooking(ME, THERAPIST, { mode: 'DESK', slug: '' })).rejects.toThrow(/Enter/);
    });
  });
});
