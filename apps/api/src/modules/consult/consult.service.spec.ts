import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConsultService } from './consult.service';

/**
 * Tenant isolation and authorisation on practitioner status.
 *
 * The route carried only JwtAuthGuard, so any signed-in account could reach
 * this — including a client — and the query ignored tenantId entirely, so any
 * profile on the platform could be deactivated by id. Deactivating a
 * practitioner takes them out of service and hides them from booking pages.
 */
const TENANT = 1n;
const ACTOR = 10n;
const TARGET = 20n;

function makeService() {
  const prisma: any = {
    profile: {
      findFirst: vi.fn().mockResolvedValue({ role: 'OWNER' }),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    consultTherapistProfile: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    consultBooking: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const service = new ConsultService(
    prisma, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
  );
  return { service, prisma };
}

describe('ConsultService.adminUpdateTherapistStatus', () => {
  let service: ConsultService;
  let prisma: any;

  beforeEach(() => {
    ({ service, prisma } = makeService());
  });

  describe('authorisation', () => {
    for (const role of ['OWNER', 'ADMIN']) {
      it(`allows ${role}`, async () => {
        prisma.profile.findFirst.mockResolvedValue({ role });
        await expect(
          service.adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'inactive'),
        ).resolves.toBeDefined();
      });
    }

    for (const role of ['THERAPIST', 'RECEPTIONIST', 'CLIENT']) {
      it(`refuses ${role}`, async () => {
        prisma.profile.findFirst.mockResolvedValue({ role });
        await expect(
          service.adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'inactive'),
        ).rejects.toThrow(ForbiddenException);
        expect(prisma.profile.updateMany).not.toHaveBeenCalled();
      });
    }

    it('looks the actor up within the acting tenant', async () => {
      await service.adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'active');
      expect(prisma.profile.findFirst.mock.calls[0][0].where).toMatchObject({
        id: ACTOR,
        tenantId: TENANT,
      });
    });
  });

  describe('tenant scoping', () => {
    it('scopes the status change to the tenant', async () => {
      await service.adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'inactive');
      expect(prisma.profile.updateMany).toHaveBeenCalledWith({
        where: { id: TARGET, tenantId: TENANT },
        data: { status: 'inactive' },
      });
    });

    it('never uses an unscoped update', async () => {
      await service.adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'inactive');
      expect(prisma.profile.update).not.toHaveBeenCalled();
    });

    it('refuses a practitioner from another practice', async () => {
      prisma.profile.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'inactive'),
      ).rejects.toThrow(NotFoundException);
    });

    it('does not leave the practitioner hidden when the update matched nothing', async () => {
      prisma.profile.updateMany.mockResolvedValue({ count: 0 });
      await service
        .adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'inactive')
        .catch(() => undefined);
      // The follow-up write must not run for a profile we did not change.
      expect(prisma.consultTherapistProfile.updateMany).not.toHaveBeenCalled();
    });
  });

  it('hides a deactivated practitioner from public booking pages', async () => {
    await service.adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'inactive');
    expect(prisma.consultTherapistProfile.updateMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT, profileId: TARGET },
      data: { isPublic: false },
    });
  });

  it('does not change visibility when reactivating', async () => {
    await service.adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'active');
    expect(prisma.consultTherapistProfile.updateMany).not.toHaveBeenCalled();
  });
});

/**
 * The portal used to be `GET /v1/consult/public/client-portal?email=...` with no
 * guard, so anyone who knew or guessed an email could read that person's
 * appointment history — and the response carries Jitsi join links, which are
 * themselves unauthenticated. It now identifies the client from their session.
 */
describe('ConsultService.getClientPortal', () => {
  let service: ConsultService;
  let prisma: any;

  beforeEach(() => {
    ({ service, prisma } = makeService());
  });

  it('looks the client up by profile id and tenant, never by email', async () => {
    prisma.profile.findFirst.mockResolvedValue({ id: 9n, firstName: 'Ada', lastName: 'Obi' });
    await service.getClientPortal(1n, 9n);

    const where = prisma.profile.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: 9n, tenantId: 1n });
    expect(where).not.toHaveProperty('email');
  });

  it('lists a booking with its format and, in person, where to go', async () => {
    prisma.profile.findFirst.mockResolvedValue({ id: 9n, firstName: 'Ada', lastName: 'Obi' });
    const startsAt = new Date(Date.now() + 86_400_000);
    const row = (over: Record<string, unknown>) => ({
      id: 900n, status: 'CONFIRMED', paymentMethod: 'PAYSTACK', amountKobo: 1000n, holdExpiresAt: null, clientReportedPaidAt: null,
      format: 'ONLINE', location: null, videoRoomName: null,
      service: { title: 'Individual Therapy', priceKobo: 1000n },
      availability: { startsAt, endsAt: new Date(startsAt.getTime() + 3_000_000), therapist: { profile: { firstName: 'Jane', lastName: 'Smith' } } },
      ...over,
    });
    prisma.consultBooking.findMany.mockResolvedValue([
      row({}),
      row({ id: 901n, format: 'IN_PERSON', location: { name: 'Lekki studio', address: '1 Admiralty Way', city: 'Lagos', directions: 'Second floor' } }),
    ]);
    const portal: any = await service.getClientPortal(1n, 9n);
    const [online, inPerson] = portal.upcoming;
    expect(online).toMatchObject({ id: '900', format: 'ONLINE', location: null });
    expect(inPerson).toMatchObject({ id: '901', format: 'IN_PERSON', location: { name: 'Lekki studio', city: 'Lagos' } });
  });

  it('gives online sessions their room window, and never a provider link (VID-02)', async () => {
    prisma.profile.findFirst.mockResolvedValue({ id: 9n });
    const startsAt = new Date(Date.now() + 86_400_000);
    const endsAt = new Date(startsAt.getTime() + 3_000_000);
    const base = {
      status: 'CONFIRMED', paymentMethod: 'PAYSTACK', amountKobo: 1000n, holdExpiresAt: null, clientReportedPaidAt: null, location: null,
      videoRoomName: 'ud-900-x', service: { title: 'Individual Therapy', priceKobo: 1000n },
      availability: { startsAt, endsAt, therapist: { profile: { firstName: 'Jane', lastName: 'Smith' } } },
    };
    prisma.consultBooking.findMany.mockResolvedValue([
      { ...base, id: 900n, format: 'ONLINE' },
      { ...base, id: 901n, format: 'IN_PERSON', location: { name: 'Studio', address: '1 Way', city: 'Lagos', directions: null } },
    ]);
    const portal: any = await service.getClientPortal(1n, 9n);
    const [online, inPerson] = portal.upcoming;
    expect(online.joinOpensAt).toBe(new Date(startsAt.getTime() - 15 * 60_000).toISOString());
    expect(online.joinClosesAt).toBe(new Date(endsAt.getTime() + 60 * 60_000).toISOString());
    expect(inPerson.joinOpensAt).toBeNull();
    expect(online).not.toHaveProperty('videoRoomLink');
    expect(JSON.stringify(portal, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toMatch(/ud-900-x|meet\.jit\.si/);
  });

  it('lists upcoming sessions soonest first, keeping one in progress until it ends', async () => {
    prisma.profile.findFirst.mockResolvedValue({ id: 9n });
    const at = (minutesFromNow: number) => new Date(Date.now() + minutesFromNow * 60_000);
    const row = (id: bigint, startsIn: number) => ({
      id, status: 'CONFIRMED', paymentMethod: 'PAYSTACK', amountKobo: 1000n, holdExpiresAt: null, clientReportedPaidAt: null,
      format: 'ONLINE', location: null, videoRoomName: null, service: { title: 'Therapy', priceKobo: 1000n },
      availability: { startsAt: at(startsIn), endsAt: at(startsIn + 50), therapist: { profile: { firstName: 'Jane', lastName: 'Smith' } } },
    });
    // The query returns newest first.
    prisma.consultBooking.findMany.mockResolvedValue([row(3n, 24 * 60), row(2n, 10), row(1n, -5), row(0n, -120)]);
    const portal: any = await service.getClientPortal(1n, 9n);
    expect(portal.upcoming.map((s: any) => s.id)).toEqual(['1', '2', '3']);
    expect(portal.past.map((s: any) => s.id)).toEqual(['0']);
  });

  it('scopes the booking query to the tenant and that client', async () => {
    prisma.profile.findFirst.mockResolvedValue({ id: 9n });
    await service.getClientPortal(1n, 9n);
    expect(prisma.consultBooking.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: 1n,
      clientProfileId: 9n,
    });
  });

  it('returns nothing for a profile outside the tenant', async () => {
    prisma.profile.findFirst.mockResolvedValue(null);
    const result = await service.getClientPortal(1n, 9n);
    expect(result).toMatchObject({ clientName: '', upcoming: [], past: [] });
    expect(prisma.consultBooking.findMany).not.toHaveBeenCalled();
  });

  it('takes no email argument at all', () => {
    // A signature that still accepted one would invite the old call site back.
    expect(service.getClientPortal.length).toBe(2);
  });
});
