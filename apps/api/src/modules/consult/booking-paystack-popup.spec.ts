import { describe, it, expect, vi, afterEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ConsultService } from './consult.service';

/**
 * The booking wizard pays in Paystack's pop-up, which needs the transaction's
 * access code, and confirms the payment as soon as the pop-up reports success
 * rather than waiting for the webhook.
 */
const TENANT = 1n;
const CLIENT = 5n;

function make({ booking = null as any, slots = [] as any[] } = {}) {
  const startsAt = new Date('2026-10-06T10:30:00Z');
  const tx: any = {
    consultAvailability: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    profile: { findFirst: vi.fn().mockResolvedValue({ id: CLIENT, email: 'ada@example.com' }), create: vi.fn() },
    consultBooking: {
      create: vi.fn(async ({ data }: any) => ({ id: 900n, ...data })),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(0),
    },
    discountCode: { update: vi.fn() },
  };
  const prisma: any = {
    consultAvailability: {
      findFirst: vi.fn().mockResolvedValue({
        id: 3n,
        serviceId: null,
        tenantId: TENANT,
        isActive: true,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 50 * 60_000),
        service: null,
        therapist: { videoProvider: 'JITSI', profile: { firstName: 'Sarah', lastName: 'Smith' } },
        tenant: { subscriptionTier: 'PRO', name: 'Smith Therapy', slug: 'smith' },
      }),
      findMany: vi.fn().mockResolvedValue(slots),
    },
    consultService: { findFirst: vi.fn().mockResolvedValue({ id: 4n, title: 'Individual therapy', priceKobo: 3500000n, durationMinutes: 50 }) },
    consultBooking: { count: vi.fn().mockResolvedValue(0), findFirst: vi.fn().mockResolvedValue(booking), update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    profile: { findFirst: vi.fn().mockResolvedValue({ id: CLIENT, email: 'ada@example.com', firstName: 'Ada', lastName: 'Okafor', phone: '080' }) },
    tenant: { findUnique: vi.fn().mockResolvedValue({ slug: 'smith', customDomain: null, customDomainStatus: null }) },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
  };
  const billing: any = {
    calculateSplitPayout: vi.fn().mockResolvedValue({ therapistPayoutKobo: 3500000n, platformFeeKobo: 0n, tier: 'PRO', paystackSubaccountCode: 'ACCT_1' }),
  };
  const paystack: any = {
    initializeTransaction: vi.fn().mockResolvedValue({ authorization_url: 'https://checkout.paystack.com/x', access_code: 'ac_123', reference: 'r' }),
    verifyTransaction: vi.fn(),
  };
  const notifications = { notify: vi.fn(), sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  const settler: any = { settle: vi.fn().mockResolvedValue('confirmed') };
  const service = new ConsultService(
    prisma,
    notifications as any,
    { validateDiscount: vi.fn() } as any,
    billing,
    paystack,
    { pushBookingToGoogle: vi.fn() } as any,
    { available: vi.fn().mockResolvedValue(null) } as any,
    undefined,
    settler,
  );
  return { service, prisma, billing, paystack, settler, tx };
}

describe('paying for a booking in the pop-up', () => {
  it('gives the pop-up its access code and the payment reference with a new booking', async () => {
    const { service } = make();
    const res: any = await service.createBooking(TENANT, CLIENT, { serviceId: '4', availabilityId: '3' } as any);
    expect(res.accessCode).toBe('ac_123');
    expect(res.reference).toMatch(/^booking-900-/);
    expect(res.paymentUrl).toBe('https://checkout.paystack.com/x');
  });

  it('gives a retried payment a fresh access code too', async () => {
    const { service } = make({ booking: { id: 900n, tenantId: TENANT, status: 'PENDING_PAYMENT', amountKobo: 3500000n, service: { priceKobo: 3500000n }, client: { email: 'ada@example.com' }, availability: { startsAt: new Date('2026-10-06T10:30:00Z'), createdForBooking: false } } });
    const res: any = await service.getBookingPaymentUrl(TENANT, 900n, 'ada@example.com');
    expect(res).toMatchObject({ paymentUrl: 'https://checkout.paystack.com/x', accessCode: 'ac_123' });
  });

  it('confirms a paid booking straight away, the same way the webhook does', async () => {
    const { service, paystack, settler } = make({ booking: { id: 900n, tenantId: TENANT, clientProfileId: CLIENT, paymentRef: 'booking-900-1', status: 'PENDING_PAYMENT' } });
    paystack.verifyTransaction.mockResolvedValue({ status: 'success', reference: 'booking-900-1', paid_at: '2026-10-01T10:00:00Z' });
    await expect(service.confirmPublicPayment(TENANT, CLIENT, 900n)).resolves.toEqual({ status: 'CONFIRMED', forms: [] });
    expect(paystack.verifyTransaction).toHaveBeenCalledWith('booking-900-1');
    expect(settler.settle).toHaveBeenCalledWith('booking-900-1', expect.objectContaining({ status: 'success' }));
  });

  it('reports an already-confirmed booking as confirmed without asking Paystack', async () => {
    const { service, paystack } = make({ booking: { id: 900n, tenantId: TENANT, clientProfileId: CLIENT, paymentRef: 'booking-900-1', status: 'CONFIRMED' } });
    await expect(service.confirmPublicPayment(TENANT, CLIENT, 900n)).resolves.toEqual({ status: 'CONFIRMED', forms: [] });
    expect(paystack.verifyTransaction).not.toHaveBeenCalled();
  });

  it('leaves an unpaid booking pending', async () => {
    const { service, paystack, settler } = make({ booking: { id: 900n, tenantId: TENANT, clientProfileId: CLIENT, paymentRef: 'booking-900-1', status: 'PENDING_PAYMENT' } });
    paystack.verifyTransaction.mockResolvedValue({ status: 'abandoned' });
    await expect(service.confirmPublicPayment(TENANT, CLIENT, 900n)).resolves.toEqual({ status: 'PENDING_PAYMENT', forms: [] });
    expect(settler.settle).not.toHaveBeenCalled();
  });

  it("refuses to confirm another client's booking", async () => {
    const { service, prisma } = make({ booking: null });
    await expect(service.confirmPublicPayment(TENANT, CLIENT, 900n)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.consultBooking.findFirst.mock.calls[0][0].where).toMatchObject({ id: 900n, tenantId: TENANT, clientProfileId: CLIENT });
  });
});

describe('the online hold (BKG-09)', () => {
  afterEach(() => vi.useRealTimers());

  it('holds a new online booking for 35 minutes and says until when', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date('2026-10-06T08:00:00Z'));
    const { service, tx } = make();
    const res: any = await service.createBooking(TENANT, CLIENT, { serviceId: '4', availabilityId: '3' } as any);
    expect(tx.consultBooking.create.mock.calls[0][0].data.holdExpiresAt).toEqual(new Date('2026-10-06T08:35:00Z'));
    expect(res.holdExpiresAt).toBe('2026-10-06T08:35:00.000Z');
  });

  it('gives a retry a fresh 35 minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date('2026-10-06T08:30:00Z'));
    const { service, prisma } = make({ booking: { id: 900n, tenantId: TENANT, status: 'PENDING_PAYMENT', paymentMethod: 'PAYSTACK', holdExpiresAt: new Date('2026-10-06T08:35:00Z'), availabilityId: 3n, amountKobo: 3500000n, service: { priceKobo: 3500000n }, client: { email: 'ada@example.com' }, availability: { startsAt: new Date('2026-10-06T10:30:00Z'), createdForBooking: false } } });
    const res: any = await service.getBookingPaymentUrl(TENANT, 900n, 'ada@example.com');
    expect(res.holdExpiresAt).toBe('2026-10-06T09:05:00.000Z');
    expect(prisma.consultBooking.update).toHaveBeenCalledWith({ where: { id: 900n }, data: { holdExpiresAt: new Date('2026-10-06T09:05:00Z') } });
  });

  it("never shortens a staff link's longer hold", async () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date('2026-10-06T08:30:00Z'));
    const staffHold = new Date('2026-10-07T08:00:00Z');
    const { service } = make({ booking: { id: 900n, tenantId: TENANT, status: 'PENDING_PAYMENT', paymentMethod: 'PAYSTACK', holdExpiresAt: staffHold, availabilityId: 3n, amountKobo: 3500000n, service: { priceKobo: 3500000n }, client: { email: 'ada@example.com' }, availability: { startsAt: new Date('2026-10-08T10:30:00Z'), createdForBooking: false } } });
    const res: any = await service.getBookingPaymentUrl(TENANT, 900n, 'ada@example.com');
    expect(res.holdExpiresAt).toBe(staffHold.toISOString());
  });

  it('re-claims a released time that is still free', async () => {
    const { service, tx } = make({ booking: { id: 900n, tenantId: TENANT, status: 'CANCELLED', holdReleasedAt: new Date(), paymentMethod: 'PAYSTACK', availabilityId: 3n, holdExpiresAt: null, amountKobo: 3500000n, service: { priceKobo: 3500000n }, client: { email: 'ada@example.com' }, availability: { startsAt: new Date('2026-10-06T10:30:00Z'), createdForBooking: false } } });
    const res: any = await service.getBookingPaymentUrl(TENANT, 900n, 'ada@example.com');
    expect(res.accessCode).toBe('ac_123');
    expect(tx.consultAvailability.updateMany).toHaveBeenCalledWith({ where: { id: 3n, isActive: true }, data: { isActive: false } });
    expect(tx.consultBooking.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 900n, status: 'CANCELLED' }, data: { status: 'PENDING_PAYMENT', holdReleasedAt: null } });
  });

  it('says the time is gone when a released time was booked by someone else', async () => {
    const { service, tx, paystack } = make({ booking: { id: 900n, tenantId: TENANT, status: 'CANCELLED', holdReleasedAt: new Date(), paymentMethod: 'PAYSTACK', availabilityId: 3n, holdExpiresAt: null, amountKobo: 3500000n, service: { priceKobo: 3500000n }, client: { email: 'ada@example.com' }, availability: { startsAt: new Date('2026-10-06T10:30:00Z'), createdForBooking: false } } });
    tx.consultAvailability.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.getBookingPaymentUrl(TENANT, 900n, 'ada@example.com')).rejects.toThrow(/no longer available/);
    expect(paystack.initializeTransaction).not.toHaveBeenCalled();
  });

  it('only looks for pending or released bookings of this client, never a transfer', async () => {
    const { service, prisma } = make({ booking: null });
    await expect(service.getBookingPaymentUrl(TENANT, 900n, 'ada@example.com')).rejects.toThrow(/not found/i);
    expect(prisma.consultBooking.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 900n, tenantId: TENANT, paymentMethod: { not: 'MANUAL' }, client: { email: 'ada@example.com' },
      OR: [{ status: 'PENDING_PAYMENT' }, { status: 'CANCELLED', holdReleasedAt: { not: null } }],
    });
  });

  it('reports a late pop-up payment that was refunded', async () => {
    const { service, paystack, settler } = make({ booking: { id: 900n, tenantId: TENANT, clientProfileId: CLIENT, paymentRef: 'booking-900-1', status: 'CANCELLED' } });
    paystack.verifyTransaction.mockResolvedValue({ status: 'success', reference: 'booking-900-1' });
    settler.settle.mockResolvedValue('refunded');
    await expect(service.confirmPublicPayment(TENANT, CLIENT, 900n)).resolves.toEqual({ status: 'REFUNDED', forms: [] });
  });

  it('confirms a late pop-up payment whose time was still free', async () => {
    const { service, paystack, settler } = make({ booking: { id: 900n, tenantId: TENANT, clientProfileId: CLIENT, paymentRef: 'booking-900-1', status: 'CANCELLED' } });
    paystack.verifyTransaction.mockResolvedValue({ status: 'success', reference: 'booking-900-1' });
    settler.settle.mockResolvedValue('reconfirmed');
    await expect(service.confirmPublicPayment(TENANT, CLIENT, 900n)).resolves.toEqual({ status: 'CONFIRMED', forms: [] });
  });
});

describe('public times', () => {
  it("name each slot's therapist with their credentials", async () => {
    const { service } = make({
      slots: [{
        id: 5n, serviceId: null, providerProfileId: 7n, channel: 'VIDEO',
        startsAt: new Date('2026-10-06T10:30:00Z'), endsAt: new Date('2026-10-06T11:20:00Z'),
        therapist: { credentials: 'PhD, LCSW', specialty: 'Anxiety', profile: { firstName: 'Sarah', lastName: 'Smith', avatarUrl: null } },
      }],
    });
    const [slot] = await service.getPublicAvailability(TENANT);
    expect(slot.therapistTitle).toBe('PhD, LCSW · Anxiety');
  });
});
