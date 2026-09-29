import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { SessionDirectoryService } from './session-directory.service';

const TENANT = 1n;
const ACTOR = 6n;
const DAY = 86_400_000;

function make(over: Record<string, any> = {}) {
  const booking = {
    id: 900n,
    status: 'CONFIRMED',
    paymentMethod: 'PAYSTACK',
    amountKobo: 3_500_000n,
    holdExpiresAt: null,
    createdByProfileId: null,
    videoRoomName: 'room-9',
    internalSummary: null,
    clientRecap: null,
    clientRecapSentAt: null,
    client: { id: 40n, firstName: 'Ada', lastName: 'Ola', email: 'ada@example.com', phone: '0801' },
    service: { title: 'Individual Therapy' },
    availability: {
      startsAt: new Date(Date.now() + 2 * DAY),
      endsAt: new Date(Date.now() + 2 * DAY + 3_600_000),
      providerProfileId: ACTOR,
      channel: 'VIDEO',
      therapist: { profile: { firstName: 'Segun', lastName: 'Ade' } },
    },
    clinicalNotes: over.note === undefined ? [] : [over.note],
    ...(over.booking ?? {}),
  };
  const prisma: any = {
    consultBooking: {
      findMany: vi.fn().mockResolvedValue(over.rows ?? [booking]),
      findFirst: vi.fn(async ({ where }: any) => {
        if (over.found === null) return null;
        const provider = where.availability?.providerProfileId;
        if (provider !== undefined && booking.availability.providerProfileId !== provider) return null;
        return booking;
      }),
    },
    profile: { findMany: vi.fn().mockResolvedValue(over.creators ?? []), findFirst: vi.fn().mockResolvedValue({ firstName: 'Frank', lastName: 'Desk' }) },
  };
  const notifications: any = { sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  return { prisma, notifications, service: new SessionDirectoryService(prisma, notifications), booking };
}

const VIEWER = { profileId: ACTOR, viewAll: false };
const DESK = { profileId: 9n, viewAll: true, clinical: false, desk: true };

describe('listSessions', () => {
  it('forces a non-view-all actor onto their own diary', async () => {
    const { service, prisma } = make();
    await service.listSessions(TENANT, VIEWER, {});
    expect(prisma.consultBooking.findMany.mock.calls[0][0].where.availability.providerProfileId).toBe(ACTOR);
  });
  it('lets a view-all actor filter by practitioner, or see everyone', async () => {
    const { service, prisma } = make();
    await service.listSessions(TENANT, DESK, {});
    expect(prisma.consultBooking.findMany.mock.calls[0][0].where.availability).not.toHaveProperty('providerProfileId');
    await service.listSessions(TENANT, DESK, { providerProfileId: 11n });
    expect(prisma.consultBooking.findMany.mock.calls[1][0].where.availability.providerProfileId).toBe(11n);
  });
  it('upcoming excludes the past and the cancelled', async () => {
    const { service, prisma } = make();
    await service.listSessions(TENANT, DESK, { status: 'upcoming' });
    const where = prisma.consultBooking.findMany.mock.calls[0][0].where;
    expect(where.availability.startsAt.gte).toBeInstanceOf(Date);
    expect(where.status).toEqual({ not: 'CANCELLED' });
  });
  it('searches the client and the service, case-insensitively', async () => {
    const { service, prisma } = make();
    await service.listSessions(TENANT, DESK, { search: ' Ada ' });
    const where = prisma.consultBooking.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { client: { firstName: { contains: 'ada', mode: 'insensitive' } } },
      { client: { lastName: { contains: 'ada', mode: 'insensitive' } } },
      { client: { email: { contains: 'ada', mode: 'insensitive' } } },
      { service: { title: { contains: 'ada', mode: 'insensitive' } } },
    ]);
  });
  it('names who made a staff booking', async () => {
    const { service } = make({ booking: { createdByProfileId: 9n } });
    const rows = await service.listSessions(TENANT, DESK, {});
    expect(rows[0].bookedBy).toBe('Frank Desk');
  });
});

describe('getSession', () => {
  it('is not found for another practitioner’s session, same as a stranger', async () => {
    const { service } = make({ booking: { availability: { startsAt: new Date(), endsAt: new Date(), providerProfileId: 77n, channel: 'VIDEO', therapist: { profile: {} } } } });
    await expect(service.getSession(TENANT, VIEWER, 900n)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('the desk can edit and mark paid but not read the summary', async () => {
    const { service } = make({ note: { id: 3n, isLocked: true } });
    const d = await service.getSession(TENANT, DESK, 900n);
    expect(d.can).toEqual({ edit: true, summary: false, markPaid: true });
    expect(d.note).toEqual({ id: '3', status: 'COMPLETED' });
  });
  it('a clinical actor on their own session gets summary rights, not edit', async () => {
    const { service } = make();
    const d = await service.getSession(TENANT, { profileId: ACTOR, viewAll: false, clinical: true, desk: false }, 900n);
    expect(d.can).toEqual({ edit: false, summary: true, markPaid: false });
  });
  it('builds the video link from the room name', async () => {
    const { service } = make();
    const d = await service.getSession(TENANT, DESK, 900n);
    expect(d.videoRoomLink).toBe('https://meet.jit.si/room-9');
  });
});

describe('setStatus', () => {
  it('a therapist may complete their own session', async () => {
    const { service, prisma } = make();
    prisma.consultBooking.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    await service.setStatus(TENANT, VIEWER, 900n, 'COMPLETED');
    expect(prisma.consultBooking.updateMany.mock.calls[0][0].where).toMatchObject({ id: 900n, tenantId: TENANT });
  });
  it('a therapist may not touch another practitioner’s session', async () => {
    const { service } = make({ booking: { availability: { startsAt: new Date(), endsAt: new Date(), providerProfileId: 77n, channel: 'VIDEO', therapist: { profile: {} } } } });
    await expect(service.setStatus(TENANT, VIEWER, 900n, 'COMPLETED')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('a therapist may not confirm or cancel — that is the desk’s', async () => {
    const { service } = make();
    await expect(service.setStatus(TENANT, VIEWER, 900n, 'CANCELLED')).rejects.toThrow(/only mark your own sessions complete/i);
  });
  it('cancelling returns the time to the pool', async () => {
    const { service, prisma } = make();
    prisma.consultBooking.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    prisma.consultAvailability = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
    await service.setStatus(TENANT, DESK, 900n, 'CANCELLED');
    expect(prisma.consultAvailability.updateMany).toHaveBeenCalled();
  });
});

describe('rescheduleByStaff', () => {
  const slot = (over: Record<string, any> = {}) => ({
    id: 301n, tenantId: TENANT, providerProfileId: ACTOR, serviceId: null,
    startsAt: new Date(Date.now() + 3 * DAY), isActive: true, ...over,
  });
  function tx(over: Record<string, any> = {}) {
    return {
      consultBooking: {
        findFirst: vi.fn().mockResolvedValue({ id: 900n, tenantId: TENANT, status: 'CONFIRMED', availabilityId: 300n, serviceId: 20n, ...(over.booking ?? {}) }),
        update: vi.fn(),
      },
      consultAvailability: {
        findFirst: vi.fn(async ({ where }: any) => (where.id === 301n ? over.slot ?? slot() : { providerProfileId: over.oldProvider ?? ACTOR })),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
  }
  it('moves the booking and returns the old slot to the pool', async () => {
    const t = tx();
    const { service, prisma } = make();
    prisma.$transaction = vi.fn(async (fn: any) => fn(t));
    await service.rescheduleByStaff(TENANT, DESK, 900n, 301n);
    expect(t.consultAvailability.updateMany).toHaveBeenCalledWith({ where: { id: 300n, tenantId: TENANT }, data: { isActive: true } });
    expect(t.consultAvailability.update).toHaveBeenCalledWith({ where: { id: 301n }, data: { isActive: false } });
    expect(t.consultBooking.update).toHaveBeenCalledWith({ where: { id: 900n }, data: { availabilityId: 301n } });
  });
  it('refuses a slot another practitioner owns', async () => {
    const t = tx({ slot: slot({ providerProfileId: 66n }) });
    const { service, prisma } = make();
    prisma.$transaction = vi.fn(async (fn: any) => fn(t));
    await expect(service.rescheduleByStaff(TENANT, DESK, 900n, 301n)).rejects.toThrow(/same practitioner/i);
    expect(t.consultBooking.update).not.toHaveBeenCalled();
  });
  it('refuses a taken slot, a past slot, or the wrong service', async () => {
    for (const bad of [slot({ isActive: false }), slot({ startsAt: new Date(Date.now() - DAY) }), slot({ serviceId: 21n })]) {
      const t = tx({ slot: bad });
      const { service, prisma } = make();
      prisma.$transaction = vi.fn(async (fn: any) => fn(t));
      await expect(service.rescheduleByStaff(TENANT, DESK, 900n, 301n)).rejects.toThrow();
    }
  });
  it('refuses a completed or cancelled session', async () => {
    for (const status of ['COMPLETED', 'CANCELLED']) {
      const t = tx({ booking: { status } });
      const { service, prisma } = make();
      prisma.$transaction = vi.fn(async (fn: any) => fn(t));
      await expect(service.rescheduleByStaff(TENANT, DESK, 900n, 301n)).rejects.toThrow(/cannot be moved/i);
    }
  });
});
