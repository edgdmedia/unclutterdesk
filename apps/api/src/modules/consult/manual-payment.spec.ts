import { describe, expect, it, vi } from 'vitest';
import { ConsultService } from './consult.service';
import { ConsultCron } from './consult.cron';
import { holdExpiry, ManualPaymentService, transferReference } from './manual-payment.service';

const TENANT = 1n;
const DETAILS = { bankName: 'GTBank', accountName: 'Calm Practice Ltd', accountNumber: '0123456789', instructions: null };

function manualService(tenant: Record<string, unknown> = {}) {
  const prisma: any = {
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ manualPaymentsEnabled: true, manualPaymentDetails: DETAILS, subscriptionTier: 'PRO', ...tenant }),
      update: vi.fn(),
    },
    consultBooking: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn() },
    profile: { findMany: vi.fn().mockResolvedValue([{ id: 9n }]) },
  };
  const notifications: any = { sendEmail: vi.fn().mockResolvedValue({ success: true }), notify: vi.fn() };
  const calendar: any = { pushBookingToGoogle: vi.fn().mockResolvedValue(undefined) };
  const notifier = { booked: vi.fn(), confirmed: vi.fn().mockResolvedValue(undefined) };
  return { prisma, notifications, calendar, notifier, service: new ManualPaymentService(prisma, notifications, calendar, notifier as any) };
}

describe('the hold on a bank-transfer booking', () => {
  const now = new Date('2026-10-01T09:00:00Z');
  it('lasts 48 hours', () => {
    expect(holdExpiry(now, new Date('2026-10-10T09:00:00Z')).toISOString()).toBe('2026-10-03T09:00:00.000Z');
  });
  it('never outlasts the session itself', () => {
    const startsAt = new Date('2026-10-02T10:00:00Z');
    expect(holdExpiry(now, startsAt)).toEqual(startsAt);
  });
});

describe('practice settings', () => {
  it('are refused on Starter, whose bookings carry the platform fee', async () => {
    const { service } = manualService({ subscriptionTier: 'STARTER', manualPaymentsEnabled: false });
    await expect(service.updateSettings(TENANT, { enabled: true, details: DETAILS })).rejects.toThrow(/Pro and Clinic/);
  });

  it('need complete bank details before turning on', async () => {
    const { service } = manualService({ manualPaymentsEnabled: false, manualPaymentDetails: null });
    await expect(service.updateSettings(TENANT, { enabled: true, details: { ...DETAILS, accountNumber: '123' } })).rejects.toThrow(/10-digit/);
  });

  it('are off until the practice turns them on', async () => {
    const { service } = manualService({ manualPaymentsEnabled: false });
    expect(await service.available(TENANT)).toBeNull();
  });

  // A practice that drops to Starter keeps its switch, but stops offering transfers.
  it('stop applying if the practice leaves Pro', async () => {
    const { service } = manualService({ subscriptionTier: 'STARTER' });
    expect(await service.available(TENANT)).toBeNull();
  });
});

describe('confirming a transfer', () => {
  it('only confirms a manual booking still waiting, in one conditional update', async () => {
    const { prisma, service } = manualService();
    await service.markPaid(TENANT, 9n, 100n);
    const call = prisma.consultBooking.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: 100n, tenantId: TENANT, status: 'PENDING_PAYMENT', OR: [{ paymentMethod: 'MANUAL' }, { createdByProfileId: { not: null } }] });
    expect(call.data).toMatchObject({ status: 'CONFIRMED', paymentConfirmedByProfileId: 9n });
  });

  it('says so when the hold already ran out', async () => {
    const { prisma, service } = manualService();
    prisma.consultBooking.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.markPaid(TENANT, 9n, 100n)).rejects.toThrow(/not waiting for a transfer/);
  });

  it('emails the client that the session is confirmed', async () => {
    const { prisma, notifier, service } = manualService();
    prisma.consultBooking.findUnique.mockResolvedValue({
      id: 100n, tenantId: TENANT, clientProfileId: 5n, amountKobo: 2_500_000n,
      tenant: { name: 'Calm', slug: 'calm', manualPaymentDetails: DETAILS },
      service: { title: 'Therapy', priceKobo: 2_500_000n },
      availability: { startsAt: new Date('2026-10-02T10:00:00Z') },
      client: { firstName: 'Ada', lastName: null, email: 'ada@example.com' },
    });
    await service.markPaid(TENANT, 9n, 100n);
    // One confirmed email for every path; it carries the join link, which a
    // hold must never have seen before this moment.
    expect(notifier.confirmed).toHaveBeenCalledWith(100n);
  });

  it('confirms through the same notifier whatever the payment was', async () => {
    const { prisma, notifier, service } = manualService();
    const booked = {
      id: 900n, tenantId: TENANT, clientProfileId: 5n, amountKobo: 2_500_000n,
      tenant: { name: 'Calm', slug: 'calm', manualPaymentDetails: DETAILS },
      service: { title: 'Therapy', priceKobo: 2_500_000n },
      availability: { startsAt: new Date('2026-10-02T10:00:00Z') },
      client: { firstName: 'Ada', lastName: null, email: 'ada@example.com' },
    };
    prisma.consultBooking.findUnique.mockResolvedValue({ ...booked, paymentMethod: 'PAYSTACK' });
    await service.markPaid(TENANT, 9n, 900n);
    expect(notifier.confirmed).toHaveBeenCalledWith(900n);

    prisma.consultBooking.findUnique.mockResolvedValue({ ...booked, paymentMethod: 'MANUAL' });
    await service.markPaid(TENANT, 9n, 900n);
    expect(notifier.confirmed).toHaveBeenCalledTimes(2);
  });

  it('lets only the booking’s own client report a transfer', async () => {
    const { prisma, service } = manualService();
    prisma.consultBooking.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.clientReportsPaid(TENANT, 100n, 'someone@else.com')).rejects.toThrow(/No booking/);
    expect(prisma.consultBooking.updateMany.mock.calls[0][0].where.client).toEqual({ email: 'someone@else.com' });
  });

  it('gives a reference staff can match', () => {
    expect(transferReference(123n)).toBe('UD-123');
  });
});

describe('booking with a bank transfer', () => {
  function booking(manual: typeof DETAILS | null) {
    const startsAt = new Date(Date.now() + 7 * 86_400_000);
    const tx: any = {
      consultAvailability: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      profile: { findFirst: vi.fn().mockResolvedValue({ id: 5n, email: 'ada@example.com' }), create: vi.fn() },
      consultBooking: { create: vi.fn(({ data }: any) => ({ id: 100n, ...data })), update: vi.fn() },
      discountCode: { update: vi.fn() },
    };
    const prisma: any = {
      consultAvailability: {
        findFirst: vi.fn().mockResolvedValue({
          id: 3n, tenantId: TENANT, isActive: true, startsAt, endsAt: new Date(startsAt.getTime() + 50 * 60_000),
          service: { id: 4n, title: 'Therapy', priceKobo: 2_500_000n, durationMinutes: 50 },
          therapist: { videoProvider: 'JITSI', profile: { firstName: 'Jane', lastName: 'Smith' } },
          tenant: { subscriptionTier: 'PRO', name: 'Practice', slug: 'p' },
        }),
      },
      consultBooking: { count: vi.fn().mockResolvedValue(0) },
      profile: { findFirst: vi.fn().mockResolvedValue({ id: 5n, email: 'ada@example.com', firstName: 'Ada', lastName: 'Obi', phone: null }) },
      $transaction: vi.fn(async (cb: any) => cb(tx)),
    };
    const paystack = { initializeTransaction: vi.fn() };
    const manualPayments = { available: vi.fn().mockResolvedValue(manual), announce: vi.fn().mockResolvedValue(undefined) };
    const service = new ConsultService(
      prisma, { notify: vi.fn(), sendEmail: vi.fn().mockResolvedValue({ success: true }) } as any, { validateDiscount: vi.fn() } as any,
      { calculateSplitPayout: vi.fn().mockResolvedValue({ therapistPayoutKobo: 1n, platformFeeKobo: 0n, tier: 'PRO' }) } as any,
      paystack as any, { pushBookingToGoogle: vi.fn() } as any, manualPayments as any,
    );
    return { service, tx, paystack, manualPayments };
  }
  const dto = { availabilityId: '3', serviceId: '4', email: 'ada@example.com', firstName: 'Ada', lastName: 'Obi', paymentMethod: 'MANUAL' };

  it('holds the slot, skips Paystack, and returns the bank details and reference', async () => {
    const { service, tx, paystack, manualPayments } = booking(DETAILS);
    const result: any = await service.createBooking(TENANT, 5n, dto);
    const data = tx.consultBooking.create.mock.calls[0][0].data;
    expect(data.paymentMethod).toBe('MANUAL');
    expect(data.holdExpiresAt).toBeInstanceOf(Date);
    expect(paystack.initializeTransaction).not.toHaveBeenCalled();
    expect(result.paymentUrl).toBeNull();
    expect(result.manualPayment).toMatchObject({ accountNumber: '0123456789', amountKobo: '2500000', reference: 'UD-100' });
    expect(manualPayments.announce).toHaveBeenCalledWith(100n);
  });

  // The page could send MANUAL for a practice that does not offer it.
  it('refuses a transfer the practice does not offer, before claiming the slot', async () => {
    const { service, tx } = booking(null);
    await expect(service.createBooking(TENANT, 5n, dto)).rejects.toThrow(/not taking bank transfers/);
    expect(tx.consultAvailability.updateMany).not.toHaveBeenCalled();
  });
});

describe('releasing unpaid holds', () => {
  it('uses 30 minutes for online payments and the hold time for transfers, and does not undo a payment', async () => {
    const tx: any = {
      consultBooking: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      consultAvailability: { updateMany: vi.fn() },
    };
    const prisma: any = {
      consultBooking: { findMany: vi.fn().mockResolvedValue([{ id: 7n, availabilityId: 3n, paymentMethod: 'MANUAL' }]) },
      $transaction: vi.fn(async (cb: any) => cb(tx)),
    };
    const manual: any = { released: vi.fn() };
    await new ConsultCron(prisma, manual).handleBookingExpiry();

    const where = prisma.consultBooking.findMany.mock.calls[0][0].where;
    expect(where.OR[0].paymentMethod).toEqual({ not: 'MANUAL' });
    expect(where.OR[0].holdExpiresAt).toBeNull();
    expect(where.OR[1].paymentMethod).toEqual({ not: 'MANUAL' });
    expect(where.OR[2].paymentMethod).toBe('MANUAL');
    // Marked paid in the meantime: nothing released, nobody told.
    expect(tx.consultBooking.updateMany.mock.calls[0][0].where.status).toBe('PENDING_PAYMENT');
    expect(tx.consultAvailability.updateMany).not.toHaveBeenCalled();
    expect(manual.released).not.toHaveBeenCalled();
  });
});

describe('staff payment-link bookings', () => {
  it('the cron uses the booking’s own hold, not the 30-minute online rule', async () => {
    const prisma: any = { consultBooking: { findMany: vi.fn().mockResolvedValue([]) } };
    await new ConsultCron(prisma, {} as any).handleBookingExpiry();
    const or = prisma.consultBooking.findMany.mock.calls[0][0].where.OR;
    expect(or).toEqual([
      { paymentMethod: { not: 'MANUAL' }, holdExpiresAt: null, createdAt: { lt: expect.any(Date) } },
      { paymentMethod: { not: 'MANUAL' }, holdExpiresAt: { lt: expect.any(Date) } },
      { paymentMethod: 'MANUAL', holdExpiresAt: { lt: expect.any(Date) } },
    ]);
  });

  it('a lapsed hold reopens an ordinary slot but never a time staff made for that booking', async () => {
    const tx: any = {
      consultBooking: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      consultAvailability: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma: any = {
      consultBooking: { findMany: vi.fn().mockResolvedValue([{ id: 7n, availabilityId: 3n, paymentMethod: 'PAYSTACK' }]) },
      $transaction: vi.fn(async (cb: any) => cb(tx)),
    };
    await new ConsultCron(prisma, { released: vi.fn() } as any).handleBookingExpiry();
    expect(tx.consultAvailability.updateMany).toHaveBeenCalledWith({
      where: { id: 3n, createdForBooking: false },
      data: { isActive: true },
    });
  });

  it('staff can mark a link booking paid when the client pays at the practice', async () => {
    const { service, prisma } = manualService();
    await service.markPaid(TENANT, 9n, 900n);
    expect(prisma.consultBooking.updateMany.mock.calls[0][0].where).toEqual({
      id: 900n,
      tenantId: TENANT,
      status: 'PENDING_PAYMENT',
      OR: [{ paymentMethod: 'MANUAL' }, { createdByProfileId: { not: null } }],
    });
  });
});
