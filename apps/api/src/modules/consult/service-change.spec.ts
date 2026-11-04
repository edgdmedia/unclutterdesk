import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SessionDirectoryService } from './session-directory.service';
import { moneyAfterServiceChange } from './service-change';

/**
 * A client booked Consultation and meant Individual Session (plan
 * 2026-11-04-change-session-service). Staff change the service; the time
 * stretches if free, and any extra price is a balance the desk settles.
 */
const TENANT = 1n;
const PROVIDER = 6n;
const HOUR = 3_600_000;
const CONSULT = 2n;
const SESSION = 3n;

describe('moneyAfterServiceChange', () => {
  it('an unpaid booking simply takes the new price', () => {
    expect(moneyAfterServiceChange({ status: 'PENDING_PAYMENT', amountKobo: 1_000_000n }, 3_500_000n)).toEqual({
      amountKobo: 3_500_000n, balanceKobo: null, balanceStatus: null, overpaidKobo: 0n,
    });
  });
  it('a paid booking keeps what was paid and owes the difference', () => {
    expect(moneyAfterServiceChange({ status: 'CONFIRMED', paidAt: new Date(), amountKobo: 1_000_000n }, 3_500_000n)).toEqual({
      amountKobo: 1_000_000n, balanceKobo: 2_500_000n, balanceStatus: 'DUE', overpaidKobo: 0n,
    });
  });
  it('a cheaper service owes nothing and reports the overpayment', () => {
    expect(moneyAfterServiceChange({ status: 'CONFIRMED', paidAt: new Date(), amountKobo: 3_500_000n }, 1_000_000n)).toEqual({
      amountKobo: 3_500_000n, balanceKobo: null, balanceStatus: null, overpaidKobo: 2_500_000n,
    });
  });
  it('a free booking owes the whole new price, for the desk to collect or waive', () => {
    expect(moneyAfterServiceChange({ status: 'CONFIRMED', amountKobo: 0n }, 3_500_000n).balanceKobo).toBe(3_500_000n);
  });
  it('changing twice recomputes from what was collected, never adding balances up', () => {
    const paid = { status: 'CONFIRMED', paidAt: new Date(), amountKobo: 1_000_000n };
    moneyAfterServiceChange(paid, 3_500_000n);
    expect(moneyAfterServiceChange(paid, 2_000_000n).balanceKobo).toBe(1_000_000n);
  });
});

function make(over: { booking?: Record<string, any>; service?: Record<string, any> | null; clash?: any; slot?: Record<string, any> } = {}) {
  const startsAt = new Date(Date.now() + 48 * HOUR);
  const booking = {
    id: 900n,
    tenantId: TENANT,
    serviceId: CONSULT,
    clientProfileId: 40n,
    status: 'CONFIRMED',
    paymentMethod: 'PAYSTACK',
    paidAt: new Date(),
    amountKobo: 1_000_000n,
    format: 'ONLINE',
    availability: {
      id: 77n,
      providerProfileId: PROVIDER,
      serviceId: null,
      startsAt,
      endsAt: new Date(startsAt.getTime() + HOUR / 2),
      therapist: { profile: { firstName: 'Segun', lastName: 'Ade', timezone: 'Africa/Lagos' } },
      ...(over.slot ?? {}),
    },
    ...(over.booking ?? {}),
  };
  const service =
    over.service === null
      ? null
      : { id: SESSION, title: 'Individual Session', durationMinutes: 60, priceKobo: 3_500_000n, formats: [{ format: 'ONLINE', priceKobo: 3_500_000n, isActive: true }], ...(over.service ?? {}) };
  const tx: any = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    consultBooking: {
      findFirst: vi.fn(async ({ where }: any) => (where.id?.not !== undefined ? over.clash ?? null : booking)),
      update: vi.fn().mockResolvedValue({}),
    },
    consultService: { findFirst: vi.fn().mockResolvedValue(service) },
    consultAvailability: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), update: vi.fn().mockResolvedValue({}) },
  };
  const prisma: any = {
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    profile: { findUnique: vi.fn().mockResolvedValue({ email: 'ada@example.com', timezone: 'Africa/Lagos' }) },
    tenant: { findUnique: vi.fn().mockResolvedValue({ name: 'Calm Practice', slug: 'calm' }) },
    consultBooking: {
      findFirst: vi.fn().mockResolvedValue({ ...booking, balanceKobo: 2_500_000n, balanceStatus: 'DUE', service: { priceKobo: 1_000_000n } }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const notifications: any = { sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  return { tx, prisma, notifications, booking, service: new SessionDirectoryService(prisma, notifications) };
}

const DESK = { profileId: 9n, viewAll: true, desk: true };

describe('changeService', () => {
  it('moves a paid Consultation to Individual Session: longer time, and the difference owed', async () => {
    const { service, tx, booking, notifications } = make();
    const out = await service.changeService(TENANT, DESK, 900n, SESSION);

    const wanted = new Date(booking.availability.startsAt.getTime() + HOUR);
    // Open times in the added half hour are closed, under the staff-booking lock.
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.consultAvailability.updateMany.mock.calls[0][0].where).toMatchObject({ providerProfileId: PROVIDER, isActive: true, startsAt: { lt: wanted } });
    expect(tx.consultAvailability.update).toHaveBeenCalledWith({ where: { id: 77n }, data: { endsAt: wanted } });
    expect(tx.consultBooking.update.mock.calls[0][0].data).toMatchObject({ serviceId: SESSION, amountKobo: 1_000_000n, balanceKobo: 2_500_000n, balanceStatus: 'DUE' });
    expect(out).toMatchObject({ serviceTitle: 'Individual Session', endsAt: wanted.toISOString(), balanceKobo: '2500000', balanceStatus: 'DUE' });

    const mail = notifications.sendEmail.mock.calls[0][0];
    expect(mail.type).toBe('bookings.service_changed');
    expect(mail.message).toContain('Individual Session (60 minutes)');
    expect(mail.message).toContain('is still due');
  });

  it("refuses when the longer session would run into the practitioner's next one", async () => {
    const next = { availability: { startsAt: new Date(Date.now() + 48.5 * HOUR), endsAt: new Date(Date.now() + 49.5 * HOUR) } };
    const { service, tx } = make({ clash: next });
    await expect(service.changeService(TENANT, DESK, 900n, SESSION)).rejects.toThrow(/Reschedule the session first/);
    expect(tx.consultBooking.update).not.toHaveBeenCalled();
  });

  it('an unpaid booking takes the new price, with nothing owed', async () => {
    const { service, tx, notifications } = make({ booking: { status: 'PENDING_PAYMENT', paidAt: null } });
    await service.changeService(TENANT, DESK, 900n, SESSION);
    expect(tx.consultBooking.update.mock.calls[0][0].data).toMatchObject({ amountKobo: 3_500_000n, balanceKobo: null, balanceStatus: null });
    expect(notifications.sendEmail.mock.calls[0][0].message).toContain('The amount to pay is now');
  });

  it('a session already under way keeps its time', async () => {
    const { service, tx } = make({ slot: { startsAt: new Date(Date.now() - HOUR / 4), endsAt: new Date(Date.now() + HOUR / 4) } });
    await service.changeService(TENANT, DESK, 900n, SESSION);
    expect(tx.consultAvailability.update).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('a shorter service brings the end in, without the lock', async () => {
    const { service, tx, booking } = make({ service: { durationMinutes: 20 } });
    await service.changeService(TENANT, DESK, 900n, SESSION);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.consultAvailability.update.mock.calls[0][0].data.endsAt).toEqual(new Date(booking.availability.startsAt.getTime() + 20 * 60_000));
  });

  it('refuses a cancelled session, the same service, a service not offered, or one not in the format', async () => {
    await expect(make({ booking: { status: 'CANCELLED' } }).service.changeService(TENANT, DESK, 900n, SESSION)).rejects.toThrow(BadRequestException);
    await expect(make().service.changeService(TENANT, DESK, 900n, CONSULT)).rejects.toThrow(/already for that service/);
    await expect(make({ service: null }).service.changeService(TENANT, DESK, 900n, SESSION)).rejects.toThrow(/not offered/);
    await expect(
      make({ booking: { format: 'IN_PERSON' } }).service.changeService(TENANT, DESK, 900n, SESSION),
    ).rejects.toThrow(/not offered in person/);
  });

  it("lets a practitioner change their own session, not someone else's", async () => {
    await expect(make().service.changeService(TENANT, { profileId: PROVIDER, viewAll: false }, 900n, SESSION)).resolves.toBeTruthy();
    await expect(make().service.changeService(TENANT, { profileId: 12n, viewAll: false }, 900n, SESSION)).rejects.toThrow(ForbiddenException);
  });
});

describe('settleBalance', () => {
  it('paid at the practice: folded into what was collected, once', async () => {
    const { service, prisma } = make();
    await service.settleBalance(TENANT, 9n, 900n, 'PAID');
    const call = prisma.consultBooking.updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ balanceStatus: 'DUE' });
    expect(call.data).toMatchObject({ amountKobo: 3_500_000n, balanceStatus: 'PAID', balanceSettledByProfileId: 9n });
  });

  it('waived: the figure stays for the record', async () => {
    const { service, prisma } = make();
    await service.settleBalance(TENANT, 9n, 900n, 'WAIVED');
    expect(prisma.consultBooking.updateMany.mock.calls[0][0].data).not.toHaveProperty('amountKobo');
  });

  it('refuses when nothing is owed, or a second click lost the race', async () => {
    const none = make();
    none.prisma.consultBooking.findFirst.mockResolvedValue({ id: 900n, balanceStatus: null, balanceKobo: null });
    await expect(none.service.settleBalance(TENANT, 9n, 900n, 'PAID')).rejects.toThrow(/Nothing is owed/);
    const raced = make();
    raced.prisma.consultBooking.updateMany.mockResolvedValue({ count: 0 });
    await expect(raced.service.settleBalance(TENANT, 9n, 900n, 'WAIVED')).rejects.toThrow(/Nothing is owed/);
  });
});
