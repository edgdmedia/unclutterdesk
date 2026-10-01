import { describe, it, expect, vi } from 'vitest';
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
    consultBooking: { create: vi.fn().mockResolvedValue({ id: 900n }), update: vi.fn() },
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
    consultBooking: { count: vi.fn().mockResolvedValue(0), findFirst: vi.fn().mockResolvedValue(booking), update: vi.fn() },
    profile: { findFirst: vi.fn().mockResolvedValue({ id: CLIENT, email: 'ada@example.com', firstName: 'Ada', lastName: 'Okafor', phone: '080' }) },
    tenant: { findUnique: vi.fn().mockResolvedValue({ slug: 'smith', customDomain: null, customDomainStatus: null }) },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
  };
  const billing: any = {
    calculateSplitPayout: vi.fn().mockResolvedValue({ therapistPayoutKobo: 3500000n, platformFeeKobo: 0n, tier: 'PRO', paystackSubaccountCode: 'ACCT_1' }),
    markBookingPaid: vi.fn().mockResolvedValue(true),
  };
  const paystack: any = {
    initializeTransaction: vi.fn().mockResolvedValue({ authorization_url: 'https://checkout.paystack.com/x', access_code: 'ac_123', reference: 'r' }),
    verifyTransaction: vi.fn(),
  };
  const notifications = { notify: vi.fn(), sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  const service = new ConsultService(
    prisma,
    notifications as any,
    { validateDiscount: vi.fn() } as any,
    billing,
    paystack,
    { pushBookingToGoogle: vi.fn() } as any,
    { available: vi.fn().mockResolvedValue(null) } as any,
  );
  return { service, prisma, billing, paystack };
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
    const { service } = make({ booking: { id: 900n, tenantId: TENANT, status: 'PENDING_PAYMENT', amountKobo: 3500000n, service: { priceKobo: 3500000n }, client: { email: 'ada@example.com' } } });
    const res: any = await service.getBookingPaymentUrl(TENANT, 900n, 'ada@example.com');
    expect(res).toMatchObject({ paymentUrl: 'https://checkout.paystack.com/x', accessCode: 'ac_123' });
  });

  it('confirms a paid booking straight away, the same way the webhook does', async () => {
    const { service, paystack, billing } = make({ booking: { id: 900n, tenantId: TENANT, clientProfileId: CLIENT, paymentRef: 'booking-900-1', status: 'PENDING_PAYMENT' } });
    paystack.verifyTransaction.mockResolvedValue({ status: 'success', reference: 'booking-900-1', paid_at: '2026-10-01T10:00:00Z' });
    await expect(service.confirmPublicPayment(TENANT, CLIENT, 900n)).resolves.toEqual({ status: 'CONFIRMED' });
    expect(paystack.verifyTransaction).toHaveBeenCalledWith('booking-900-1');
    expect(billing.markBookingPaid).toHaveBeenCalledWith('booking-900-1', expect.objectContaining({ status: 'success' }));
  });

  it('reports an already-confirmed booking as confirmed without asking Paystack', async () => {
    const { service, paystack } = make({ booking: { id: 900n, tenantId: TENANT, clientProfileId: CLIENT, paymentRef: 'booking-900-1', status: 'CONFIRMED' } });
    await expect(service.confirmPublicPayment(TENANT, CLIENT, 900n)).resolves.toEqual({ status: 'CONFIRMED' });
    expect(paystack.verifyTransaction).not.toHaveBeenCalled();
  });

  it('leaves an unpaid booking pending', async () => {
    const { service, paystack, billing } = make({ booking: { id: 900n, tenantId: TENANT, clientProfileId: CLIENT, paymentRef: 'booking-900-1', status: 'PENDING_PAYMENT' } });
    paystack.verifyTransaction.mockResolvedValue({ status: 'abandoned' });
    await expect(service.confirmPublicPayment(TENANT, CLIENT, 900n)).resolves.toEqual({ status: 'PENDING_PAYMENT' });
    expect(billing.markBookingPaid).not.toHaveBeenCalled();
  });

  it("refuses to confirm another client's booking", async () => {
    const { service, prisma } = make({ booking: null });
    await expect(service.confirmPublicPayment(TENANT, CLIENT, 900n)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.consultBooking.findFirst.mock.calls[0][0].where).toMatchObject({ id: 900n, tenantId: TENANT, clientProfileId: CLIENT });
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
