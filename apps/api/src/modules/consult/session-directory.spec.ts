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
    tenant: { findUnique: vi.fn().mockResolvedValue({ name: 'Calm Practice', slug: 'calm', customDomain: null, customDomainStatus: null }) },
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
  // The note is written on the session page after a call held in Google Meet,
  // so the page carries its text — but only to someone who may write notes.
  it("gives clinical staff the session's note to carry on writing", async () => {
    const { service } = make({ note: { id: 3n, isLocked: false, subjective: 'Sleeps better', objective: null, assessment: null, plan: 'Breathing' } });
    const d = await service.getSession(TENANT, { profileId: ACTOR, viewAll: false, clinical: true }, 900n);
    expect(d.note).toEqual({ id: '3', status: 'DRAFT', subjective: 'Sleeps better', objective: '', assessment: '', plan: 'Breathing' });
  });
  it("never gives the note's text to the desk", async () => {
    const { service } = make({ note: { id: 3n, isLocked: false, subjective: 'Sleeps better', objective: null, assessment: null, plan: null } });
    const d = await service.getSession(TENANT, DESK, 900n);
    expect(d.note).toEqual({ id: '3', status: 'DRAFT' });
  });
  it('links an online session to its room in the app', async () => {
    const { service } = make();
    const d = await service.getSession(TENANT, DESK, 900n);
    expect(d.videoRoomLink).toBe('/session/900');
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
      timeOff: { findFirst: vi.fn().mockResolvedValue(over.timeOff ?? null) },
    };
  }
  it('moves the booking and returns the old slot to the pool', async () => {
    const t = tx();
    const { service, prisma } = make();
    prisma.$transaction = vi.fn(async (fn: any) => fn(t));
    await service.rescheduleByStaff(TENANT, DESK, 900n, 301n);
    expect(t.consultAvailability.updateMany).toHaveBeenCalledWith({ where: { id: 300n, tenantId: TENANT, createdForBooking: false }, data: { isActive: true } });
    expect(t.consultAvailability.update).toHaveBeenCalledWith({ where: { id: 301n }, data: { isActive: false } });
    expect(t.consultBooking.update).toHaveBeenCalledWith({ where: { id: 900n }, data: { availabilityId: 301n } });
  });
  it("gives a moved session a fresh video room when one was made for the old time", async () => {
    const t = tx({ booking: { videoProvider: 'DAILY', videoRoomName: 'ud-900-x' } });
    const { service, prisma } = make();
    prisma.$transaction = vi.fn(async (fn: any) => fn(t));
    await service.rescheduleByStaff(TENANT, DESK, 900n, 301n);
    expect(t.consultBooking.update).toHaveBeenCalledWith({ where: { id: 900n }, data: { availabilityId: 301n, videoProvider: null, videoRoomName: null } });
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
  it("lets an owner take a therapist's session into one of their own open slots (§5.4a)", async () => {
    const owner = { ...DESK, profileId: 1n };
    const t = tx({ slot: slot({ providerProfileId: 1n }), oldProvider: 66n });
    const { service, prisma } = make();
    prisma.$transaction = vi.fn(async (fn: any) => fn(t));
    await service.rescheduleByStaff(TENANT, owner, 900n, 301n, { toOwnSlot: true });
    expect(t.consultBooking.update).toHaveBeenCalledWith({ where: { id: 900n }, data: { availabilityId: 301n } });
  });
  it("refuses a 'take over' into someone else's slot", async () => {
    const owner = { ...DESK, profileId: 1n };
    const t = tx({ slot: slot({ providerProfileId: 66n }), oldProvider: 77n });
    const { service, prisma } = make();
    prisma.$transaction = vi.fn(async (fn: any) => fn(t));
    await expect(service.rescheduleByStaff(TENANT, owner, 900n, 301n, { toOwnSlot: true })).rejects.toThrow(/your own open times/i);
    expect(t.consultBooking.update).not.toHaveBeenCalled();
  });
  it('lets a therapist move their own session without view-all', async () => {
    const t = tx();
    const { service, prisma } = make();
    prisma.$transaction = vi.fn(async (fn: any) => fn(t));
    await service.rescheduleByStaff(TENANT, VIEWER, 900n, 301n);
    expect(t.consultBooking.update).toHaveBeenCalledWith({ where: { id: 900n }, data: { availabilityId: 301n } });
  });
  it('refuses a therapist moving another practitioner’s session', async () => {
    const t = tx({ oldProvider: 77n });
    const { service, prisma } = make();
    prisma.$transaction = vi.fn(async (fn: any) => fn(t));
    await expect(service.rescheduleByStaff(TENANT, VIEWER, 900n, 301n)).rejects.toThrow(/Ask the front desk/i);
    expect(t.consultBooking.update).not.toHaveBeenCalled();
  });
  it('refuses a completed or cancelled session', async () => {
    for (const status of ['COMPLETED', 'CANCELLED']) {
      const t = tx({ booking: { status } });
      const { service, prisma } = make();
      prisma.$transaction = vi.fn(async (fn: any) => fn(t));
      await expect(service.rescheduleByStaff(TENANT, DESK, 900n, 301n)).rejects.toThrow(/cannot be moved/i);
    }
  });
  it('refuses to move a session onto a day the therapist is away', async () => {
    const t = tx({ timeOff: { id: 7n } });
    const { service, prisma } = make();
    prisma.$transaction = vi.fn(async (fn: any) => fn(t));
    await expect(service.rescheduleByStaff(TENANT, DESK, 900n, 301n)).rejects.toThrow(/away on that day/i);
    expect(t.consultBooking.update).not.toHaveBeenCalled();
  });

  // A time staff made by hand for one booking may be outside working hours, so
  // it is never handed to the public when its session moves away.
  it('never reopens a time made by hand for this booking', async () => {
    const t = tx();
    const { service, prisma } = make();
    prisma.$transaction = vi.fn(async (fn: any) => fn(t));
    await service.rescheduleByStaff(TENANT, DESK, 900n, 301n);
    expect(t.consultAvailability.updateMany.mock.calls[0][0].where).toMatchObject({ id: 300n, createdForBooking: false });
  });

  it('emails the client the new time', async () => {
    const t = tx();
    const { service, prisma, notifications } = make();
    prisma.$transaction = vi.fn(async (fn: any) => fn(t));
    await service.rescheduleByStaff(TENANT, DESK, 900n, 301n);
    expect(notifications.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ada@example.com', type: 'bookings.rescheduled' }));
  });

  it('still moves the session when the email fails', async () => {
    const t = tx();
    const { service, prisma, notifications } = make();
    notifications.sendEmail.mockRejectedValue(new Error('smtp'));
    prisma.$transaction = vi.fn(async (fn: any) => fn(t));
    await expect(service.rescheduleByStaff(TENANT, DESK, 900n, 301n)).resolves.toMatchObject({ id: '900' });
  });

  describe('to a time staff choose', () => {
    const at = new Date(Date.now() + 4 * DAY);
    function customTx(over: Record<string, any> = {}) {
      const t: any = tx({ booking: { service: { durationMinutes: 50 }, format: 'ONLINE', locationId: null, ...(over.booking ?? {}) } });
      t.$executeRaw = vi.fn().mockResolvedValue(1);
      t.consultBooking.findFirst = vi.fn(async ({ where }: any) =>
        // The clash check carries the time range; the first call loads the booking.
        where.availability ? over.clash ?? null : { id: 900n, tenantId: TENANT, status: 'CONFIRMED', availabilityId: 300n, serviceId: 20n, service: { durationMinutes: 50 }, format: 'ONLINE', locationId: null, ...(over.booking ?? {}) },
      );
      t.consultAvailability.create = vi.fn().mockResolvedValue({ id: 555n, startsAt: at, endsAt: new Date(at.getTime() + 50 * 60_000) });
      t.consultAvailability.findFirst = vi.fn().mockResolvedValue({ providerProfileId: ACTOR });
      return t;
    }

    it("makes a time just for this session, as long as the service, and moves it there", async () => {
      const t = customTx();
      const { service, prisma } = make();
      prisma.$transaction = vi.fn(async (fn: any) => fn(t));
      await service.rescheduleByStaff(TENANT, DESK, 900n, { startsAt: at });
      const made = t.consultAvailability.create.mock.calls[0][0].data;
      expect(made).toMatchObject({ tenantId: TENANT, providerProfileId: ACTOR, serviceId: 20n, startsAt: at, isActive: false, createdForBooking: true, allowsOnline: true, allowsInPerson: false });
      expect(made.endsAt.getTime() - at.getTime()).toBe(50 * 60_000);
      expect(t.consultBooking.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 900n }, data: expect.objectContaining({ availabilityId: 555n }) }));
    });

    it('closes open times it overlaps, after giving the old time back', async () => {
      const t = customTx();
      const order: string[] = [];
      t.consultAvailability.updateMany = vi.fn(async ({ where }: any) => {
        order.push(where.id === 300n ? 'release-old' : 'close-overlap');
        return { count: 1 };
      });
      const { service, prisma } = make();
      prisma.$transaction = vi.fn(async (fn: any) => fn(t));
      await service.rescheduleByStaff(TENANT, DESK, 900n, { startsAt: at });
      // Closing second means a reopened old time that overlaps the new one is shut again.
      expect(order).toEqual(['release-old', 'close-overlap']);
      expect(t.$executeRaw).toHaveBeenCalled();
    });

    it('refuses a time that clashes with another session', async () => {
      const t = customTx({ clash: { availability: { startsAt: at, endsAt: new Date(at.getTime() + 3_600_000) } } });
      const { service, prisma } = make();
      prisma.$transaction = vi.fn(async (fn: any) => fn(t));
      await expect(service.rescheduleByStaff(TENANT, DESK, 900n, { startsAt: at })).rejects.toThrow(/already has a session/i);
      expect(t.consultAvailability.create).not.toHaveBeenCalled();
    });

    it('does not count the session being moved as a clash', async () => {
      const t = customTx();
      const { service, prisma } = make();
      prisma.$transaction = vi.fn(async (fn: any) => fn(t));
      await service.rescheduleByStaff(TENANT, DESK, 900n, { startsAt: at });
      const clashCheck = t.consultBooking.findFirst.mock.calls.find((c: any[]) => c[0].where.availability)[0].where;
      expect(clashCheck.id).toEqual({ not: 900n });
    });

    it('refuses a time in the past', async () => {
      const t = customTx();
      const { service, prisma } = make();
      prisma.$transaction = vi.fn(async (fn: any) => fn(t));
      await expect(service.rescheduleByStaff(TENANT, DESK, 900n, { startsAt: new Date(Date.now() - DAY) })).rejects.toThrow(/future/i);
    });

    it('keeps an in-person session in person, at its place', async () => {
      const t = customTx({ booking: { format: 'IN_PERSON', locationId: 4n } });
      const { service, prisma } = make();
      prisma.$transaction = vi.fn(async (fn: any) => fn(t));
      await service.rescheduleByStaff(TENANT, DESK, 900n, { startsAt: at });
      expect(t.consultAvailability.create.mock.calls[0][0].data).toMatchObject({ allowsOnline: false, allowsInPerson: true, locationId: 4n, channel: 'IN_PERSON' });
    });

    it('refuses a day the therapist is away', async () => {
      const t = customTx();
      t.timeOff.findFirst = vi.fn().mockResolvedValue({ id: 7n });
      const { service, prisma } = make();
      prisma.$transaction = vi.fn(async (fn: any) => fn(t));
      await expect(service.rescheduleByStaff(TENANT, DESK, 900n, { startsAt: at })).rejects.toThrow(/away on that day/i);
    });
  });
});

describe('summaries', () => {
  it('stores both texts, trimmed', async () => {
    const { service, prisma } = make();
    prisma.consultBooking.update = vi.fn().mockResolvedValue({ id: 900n });
    await service.setSummary(TENANT, { profileId: ACTOR, viewAll: false, clinical: true }, 900n, {
      internalSummary: '  worked on grounding  ',
      clientRecap: 'Practised the 4-7-8 breath. ',
    });
    expect(prisma.consultBooking.update.mock.calls[0][0].data).toMatchObject({
      internalSummary: 'worked on grounding',
      clientRecap: 'Practised the 4-7-8 breath.',
    });
  });
  it('refuses to send a recap that was never written', async () => {
    const { service } = make();
    await expect(service.sendRecap(TENANT, DESK, 900n)).rejects.toThrow(/Write the recap/i);
  });
  it('emails the client and stamps the send', async () => {
    const { service, prisma, notifications } = make({ booking: { clientRecap: 'Well done this week.' } });
    prisma.consultBooking.update = vi.fn().mockResolvedValue({ id: 900n });
    prisma.tenant = { findUnique: vi.fn().mockResolvedValue({ name: 'Smith Therapy', slug: 'dr-smith', customDomain: null, customDomainStatus: null }) };
    await service.sendRecap(TENANT, { profileId: ACTOR, viewAll: false, clinical: true }, 900n);
    expect(notifications.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'ada@example.com',
      type: 'bookings.session_recap',
      profileId: 40n,
    }));
    expect(prisma.consultBooking.update.mock.calls[0][0].data.clientRecapSentAt).toBeInstanceOf(Date);
  });
});

describe('client history', () => {
  it('lists one client’s sessions newest first, scoped to the tenant', async () => {
    const { service, prisma } = make();
    await service.clientSessions(TENANT, DESK, 40n);
    const args = prisma.consultBooking.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ tenantId: TENANT, clientProfileId: 40n });
    expect(args.orderBy).toEqual({ availability: { startsAt: 'desc' } });
  });
  it('totals what the client paid and what is outstanding', async () => {
    const { service, prisma } = make();
    prisma.consultBooking.findMany = vi.fn().mockResolvedValue([
      { id: 1n, service: { title: 'A', priceKobo: 200n }, availability: { startsAt: new Date() }, amountKobo: 200n, discountCodeUsed: null, status: 'CONFIRMED', paidAt: new Date(), paymentRef: 'r1', createdAt: new Date() },
      { id: 2n, service: { title: 'B', priceKobo: 500n }, availability: { startsAt: new Date() }, amountKobo: null, discountCodeUsed: null, status: 'PENDING_PAYMENT', paidAt: null, paymentRef: null, createdAt: new Date() },
    ]);
    const out = await service.clientPayments(TENANT, 40n);
    expect(out.totalPaidKobo).toBe('200');
    expect(out.outstandingKobo).toBe('500');
  });
});
