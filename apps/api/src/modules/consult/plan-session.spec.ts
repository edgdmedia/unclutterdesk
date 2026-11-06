import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlanSessionService } from './plan-session.service';

/**
 * Not-yet-scheduled sessions (spec §11.2, first piece). A client booked four
 * sessions; the fourth should wait until she knows when she is free. Staff
 * turn it into "not scheduled": its time goes back, its payment stays on the
 * booking it was paid on, and she picks a new time in the portal — booked
 * straight away, with no second payment.
 */
const TENANT = 1n;
const PROVIDER = 6n;
const CLIENT = 40n;
const DESK = { profileId: 9n, viewAll: true };
const OWN = { profileId: PROVIDER, viewAll: false };
const future = (h: number) => new Date(Date.now() + h * 3_600_000);

function booking(over: Record<string, unknown> = {}) {
  return {
    id: 900n, tenantId: TENANT, clientProfileId: CLIENT, serviceId: 2n, availabilityId: 300n,
    status: 'CONFIRMED', paymentMethod: 'PAYSTACK', amountKobo: 3_500_000n, paidAt: new Date('2026-11-01T10:00:00Z'),
    format: 'ONLINE', locationId: null, planSession: null,
    availability: { id: 300n, providerProfileId: PROVIDER, startsAt: future(72), endsAt: future(73) },
    service: { id: 2n, title: 'Individual Therapy', durationMinutes: 50, priceKobo: 3_500_000n },
    ...over,
  };
}

function planSession(over: Record<string, unknown> = {}) {
  return {
    id: 50n, tenantId: TENANT, planId: 5n, lineId: 7n, clientProfileId: CLIENT, providerProfileId: PROVIDER,
    serviceId: 2n, format: 'ONLINE', locationId: null, status: 'PAID', paymentMethod: 'PAYSTACK',
    amountKobo: 3_500_000n, paidAt: new Date('2026-11-01T10:00:00Z'), paidOnBookingId: 900n, bookingId: null,
    service: { id: 2n, title: 'Individual Therapy', durationMinutes: 50 },
    ...over,
  };
}

function make(over: { booking?: any; plan?: any; line?: any; ps?: any; slot?: any; open?: any[]; claimed?: number; cancelled?: number } = {}) {
  const tx: any = {
    consultBooking: {
      updateMany: vi.fn().mockResolvedValue({ count: over.cancelled ?? 1 }),
      create: vi.fn(async ({ data }: any) => ({ id: 901n, ...data })),
    },
    consultAvailability: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn(async ({ data }: any) => ({ id: 555n, ...data })),
    },
    sessionPlan: {
      findFirst: vi.fn().mockResolvedValue(over.plan === undefined ? null : over.plan),
      create: vi.fn(async ({ data }: any) => ({ id: 5n, ...data })),
    },
    sessionPlanLine: {
      findFirst: vi.fn().mockResolvedValue(over.line === undefined ? null : over.line),
      create: vi.fn(async ({ data }: any) => ({ id: 7n, ...data })),
      update: vi.fn(async ({ data }: any) => ({ id: 7n, ...data })),
    },
    planSession: {
      create: vi.fn(async ({ data }: any) => ({ id: 50n, ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: over.claimed ?? 1 }),
      update: vi.fn(),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
  tx.consultBooking.findFirst = vi.fn().mockResolvedValue(null);
  const prisma: any = {
    consultBooking: {
      findFirst: vi.fn(async ({ where }: any) => {
        const b = over.booking === undefined ? booking() : over.booking;
        if (!b) return null;
        const p = where.availability?.providerProfileId;
        if (p !== undefined && p !== b.availability.providerProfileId) return null;
        return b;
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    planSession: {
      findFirst: vi.fn(async ({ where }: any) => {
        const ps = over.ps === undefined ? planSession() : over.ps;
        if (!ps) return null;
        if (where.clientProfileId !== undefined && where.clientProfileId !== ps.clientProfileId) return null;
        if (where.providerProfileId !== undefined && where.providerProfileId !== ps.providerProfileId) return null;
        return ps;
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    consultAvailability: {
      findFirst: vi.fn().mockResolvedValue(
        over.slot === undefined
          ? { id: 301n, tenantId: TENANT, providerProfileId: PROVIDER, serviceId: null, isActive: true, startsAt: future(96), endsAt: future(97), allowsOnline: true, allowsInPerson: false, locationId: null }
          : over.slot,
      ),
    },
    consultService: {
      findFirst: vi.fn().mockResolvedValue({ id: 2n, title: 'Individual Therapy', durationMinutes: 50 }),
      findMany: vi.fn().mockResolvedValue([{ id: 2n, title: 'Individual Therapy', durationMinutes: 50 }]),
    },
    consultTherapistProfile: { findFirst: vi.fn().mockResolvedValue({ profile: { firstName: 'Segun', lastName: 'Ade', timezone: 'Africa/Lagos' } }) },
    tenant: { findUnique: vi.fn().mockResolvedValue({ id: TENANT, name: 'Calm Practice', slug: 'calm', subscriptionTier: 'PRO' }) },
    profile: { findFirst: vi.fn().mockResolvedValue({ id: CLIENT, firstName: 'Ada', lastName: 'Ola', email: 'ada@example.com', timezone: null }) },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
  };
  const consult: any = {
    getPublicAvailability: vi.fn().mockResolvedValue(over.open ?? [{ id: '301', startsAt: future(96).toISOString(), endsAt: future(97).toISOString(), formats: ['ONLINE'] }]),
    assertNotAway: vi.fn().mockResolvedValue(undefined),
  };
  const notifications: any = { sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  const calendar: any = { pushBookingToGoogle: vi.fn().mockResolvedValue(undefined) };
  const service = new PlanSessionService(prisma, consult, notifications, calendar);
  // The booking emails and calendar push are StaffBookingService's, tested there.
  (service as any).afterBooking = vi.fn().mockResolvedValue(undefined);
  (service as any).withinMonthlyLimit = vi.fn().mockResolvedValue(undefined);
  return { service, prisma, tx, consult, notifications, calendar };
}

describe('turning a booked session into "not scheduled"', () => {
  it('gives the time back and keeps the payment on the booking it was paid on', async () => {
    const { service, tx } = make();
    await service.unschedule(TENANT, DESK, 900n);
    const ps = tx.planSession.create.mock.calls[0][0].data;
    expect(ps).toMatchObject({
      tenantId: TENANT, clientProfileId: CLIENT, providerProfileId: PROVIDER, serviceId: 2n, format: 'ONLINE',
      status: 'PAID', paymentMethod: 'PAYSTACK', amountKobo: 3_500_000n, paidOnBookingId: 900n, bookingId: null,
    });
    // The booking is the record of the money: cancelled, never rewritten.
    const cancel = tx.consultBooking.updateMany.mock.calls[0][0];
    expect(cancel.where).toMatchObject({ id: 900n, tenantId: TENANT, status: 'CONFIRMED' });
    expect(cancel.data).toMatchObject({ status: 'CANCELLED', unscheduledAt: expect.any(Date) });
    expect(cancel.data).not.toHaveProperty('amountKobo');
    expect(cancel.data).not.toHaveProperty('paidAt');
    expect(tx.consultAvailability.updateMany).toHaveBeenCalledWith({ where: { id: 300n, tenantId: TENANT, createdForBooking: false }, data: { isActive: true } });
  });

  it("starts the client's plan with this practitioner, or adds to it", async () => {
    const fresh = make();
    await fresh.service.unschedule(TENANT, DESK, 900n);
    expect(fresh.tx.sessionPlan.create.mock.calls[0][0].data).toMatchObject({ tenantId: TENANT, clientProfileId: CLIENT, providerProfileId: PROVIDER, status: 'ACTIVE' });
    expect(fresh.tx.sessionPlanLine.create.mock.calls[0][0].data).toMatchObject({ planId: 5n, serviceId: 2n, count: 1 });

    const existing = make({ plan: { id: 5n }, line: { id: 7n, count: 3 } });
    await existing.service.unschedule(TENANT, DESK, 900n);
    expect(existing.tx.sessionPlan.create).not.toHaveBeenCalled();
    expect(existing.tx.sessionPlanLine.update).toHaveBeenCalledWith({ where: { id: 7n }, data: { count: 4 } });
  });

  it('a session already from a plan goes back to not scheduled, not into a second plan session', async () => {
    const { service, tx } = make({ booking: booking({ paymentMethod: 'PLAN', amountKobo: 0n, paidAt: null, planSession: { id: 50n } }) });
    await service.unschedule(TENANT, DESK, 900n);
    expect(tx.planSession.create).not.toHaveBeenCalled();
    expect(tx.planSession.updateMany).toHaveBeenCalledWith({ where: { id: 50n, tenantId: TENANT, bookingId: 900n }, data: { status: 'PAID', bookingId: null } });
  });

  it("takes the freed session's event out of Google Calendar", async () => {
    const { service, calendar } = make() as any;
    await service.unschedule(TENANT, DESK, 900n);
    expect(calendar.pushBookingToGoogle).toHaveBeenCalledWith(900n);
  });

  it('emails the client to choose a new time', async () => {
    const { service, notifications } = make();
    await service.unschedule(TENANT, DESK, 900n);
    expect(notifications.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ada@example.com', type: 'bookings.unscheduled', actionLabel: 'Choose a time' }));
  });

  it('refuses an unpaid, completed or cancelled session', async () => {
    for (const status of ['PENDING_PAYMENT', 'COMPLETED', 'CANCELLED']) {
      const { service, tx } = make({ booking: booking({ status }) });
      await expect(service.unschedule(TENANT, DESK, 900n)).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.planSession.create).not.toHaveBeenCalled();
    }
  });

  it('refuses when another click already did it', async () => {
    const { service } = make({ cancelled: 0 });
    await expect(service.unschedule(TENANT, DESK, 900n)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("a therapist may not unschedule another practitioner's session", async () => {
    const { service } = make();
    await expect(service.unschedule(TENANT, { profileId: 77n, viewAll: false }, 900n)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('choosing the time for a not-yet-scheduled session', () => {
  it('the client books one of the open times straight away, with no payment', async () => {
    const { service, tx, consult } = make();
    await service.scheduleByClient(TENANT, CLIENT, 50n, 301n);
    // The times the booking page would offer, for this practitioner, service and format.
    expect(consult.getPublicAvailability).toHaveBeenCalledWith(TENANT, PROVIDER, 2n, 'ONLINE');
    const made = tx.consultBooking.create.mock.calls[0][0].data;
    expect(made).toMatchObject({ tenantId: TENANT, clientProfileId: CLIENT, serviceId: 2n, availabilityId: 301n, status: 'CONFIRMED', paymentMethod: 'PLAN', amountKobo: 0n, format: 'ONLINE' });
    expect(made.paidAt).toBeUndefined();
    expect(tx.planSession.update).toHaveBeenCalledWith({ where: { id: 50n }, data: { bookingId: 901n } });
  });

  it('claims the plan session and the time together, so a double click books once', async () => {
    const { service, tx } = make();
    await service.scheduleByClient(TENANT, CLIENT, 50n, 301n);
    expect(tx.planSession.updateMany.mock.calls[0][0]).toEqual({ where: { id: 50n, tenantId: TENANT, status: 'PAID', bookingId: null }, data: { status: 'SCHEDULED' } });
    expect(tx.consultAvailability.updateMany.mock.calls[0][0]).toEqual({ where: { id: 301n, tenantId: TENANT, isActive: true }, data: { isActive: false } });

    const twice = make({ claimed: 0 });
    await expect(twice.service.scheduleByClient(TENANT, CLIENT, 50n, 301n)).rejects.toThrow(/already/i);
    expect(twice.tx.consultBooking.create).not.toHaveBeenCalled();
  });

  it('a client may only take a time the booking page offers', async () => {
    const { service, tx } = make({ open: [] });
    await expect(service.scheduleByClient(TENANT, CLIENT, 50n, 301n)).rejects.toThrow(/no longer open/i);
    expect(tx.consultBooking.create).not.toHaveBeenCalled();
  });

  it("a client may not schedule someone else's session", async () => {
    const { service } = make();
    await expect(service.scheduleByClient(TENANT, 41n, 50n, 301n)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('counts toward the monthly booking limit when scheduled', async () => {
    const { service } = make();
    await service.scheduleByClient(TENANT, CLIENT, 50n, 301n);
    expect((service as any).withinMonthlyLimit).toHaveBeenCalledWith(TENANT, expect.any(Date));
  });

  it('sends the usual booking emails and calendar invite', async () => {
    const { service } = make();
    await service.scheduleByClient(TENANT, CLIENT, 50n, 301n);
    expect((service as any).afterBooking).toHaveBeenCalledWith([expect.objectContaining({ bookingId: '901', status: 'CONFIRMED', paymentMethod: 'PLAN' })], true);
  });

  it('staff may choose a custom time for the client', async () => {
    const { service, tx } = make();
    const at = future(120);
    await service.scheduleByStaff(TENANT, DESK, 50n, { startsAt: at });
    const slot = tx.consultAvailability.create.mock.calls[0][0].data;
    expect(slot).toMatchObject({ providerProfileId: PROVIDER, serviceId: 2n, startsAt: at, createdForBooking: true, isActive: false });
    expect(tx.consultBooking.create.mock.calls[0][0].data).toMatchObject({ availabilityId: 555n, paymentMethod: 'PLAN', createdByProfileId: 9n });
  });

  it("an in-person session stays in person: an online-only time is refused", async () => {
    const { service } = make({ ps: planSession({ format: 'IN_PERSON', locationId: 4n }) });
    await expect(service.scheduleByStaff(TENANT, DESK, 50n, { availabilityId: 301n })).rejects.toThrow(/in person/i);
  });

  it("a therapist schedules only their own clients' sessions", async () => {
    const { service } = make();
    await expect(service.scheduleByStaff(TENANT, { profileId: 77n, viewAll: false }, 50n, { availabilityId: 301n })).rejects.toBeInstanceOf(NotFoundException);
    const own = make();
    await expect(own.service.scheduleByStaff(TENANT, OWN, 50n, { availabilityId: 301n })).resolves.toMatchObject({ bookingId: '901' });
  });

  it('a session already scheduled cannot be scheduled again', async () => {
    const { service } = make({ ps: null });
    await expect(service.scheduleByClient(TENANT, CLIENT, 50n, 301n)).rejects.toBeInstanceOf(NotFoundException);
  });
});
