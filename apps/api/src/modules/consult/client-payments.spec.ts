import { describe, expect, it, vi } from 'vitest';
import { clientPaymentHistory } from './client-payments';

/**
 * One client's payments, for the client page and the portal (one home: the
 * two copies of this used to drift). Bookings as before; sessions paid at
 * the practice with no time yet (§11.2) count too, once.
 */
const TENANT = 1n;
const CLIENT = 40n;
const paid = new Date('2026-11-05T10:00:00Z');

function make(bookings: any[], planSessions: any[]) {
  const prisma: any = {
    consultBooking: { findMany: vi.fn().mockResolvedValue(bookings) },
    planSession: { findMany: vi.fn().mockResolvedValue(planSessions) },
    consultService: { findMany: vi.fn().mockResolvedValue([{ id: 2n, title: 'Individual Therapy' }]) },
  };
  return prisma;
}

const booking = (over: Record<string, unknown> = {}) => ({
  id: 900n, status: 'CONFIRMED', paymentMethod: 'PAYSTACK', amountKobo: 3_500_000n, paidAt: paid, paymentRef: 'ref-1', discountCodeUsed: null,
  createdAt: paid, service: { title: 'Individual Therapy', priceKobo: 3_500_000n }, availability: { startsAt: new Date('2026-11-10T10:00:00Z') }, ...over,
});

describe("a client's payment history", () => {
  it('lists bookings as before, and totals what was paid and what is owed', async () => {
    const prisma = make([booking(), booking({ id: 901n, status: 'PENDING_PAYMENT', paidAt: null, amountKobo: 2_000_000n })], []);
    const r = await clientPaymentHistory(prisma, TENANT, CLIENT);
    expect(r.payments.map((p) => p.id)).toEqual(['booking-900', 'booking-901']);
    expect(r.totalPaidKobo).toBe('3500000');
    expect(r.outstandingKobo).toBe('2000000');
  });

  it('counts sessions paid at the practice with no time yet', async () => {
    const prisma = make([], [{ id: 50n, serviceId: 2n, amountKobo: 3_000_000n, paidAt: paid, paymentMethod: 'MANUAL', createdAt: paid, booking: null }]);
    const r = await clientPaymentHistory(prisma, TENANT, CLIENT);
    expect(r.payments).toEqual([
      expect.objectContaining({ id: 'plan-50', bookingId: null, planSessionId: '50', serviceTitle: 'Individual Therapy', sessionAt: null, amountKobo: '3000000', paidAt: paid.toISOString(), status: 'CONFIRMED' }),
    ]);
    expect(r.totalPaidKobo).toBe('3000000');
    // Only the money paid directly: one paid on a booking is that booking's row.
    expect(prisma.planSession.findMany.mock.calls[0][0].where).toMatchObject({ tenantId: TENANT, clientProfileId: CLIENT, paidOnBookingId: null });
  });

  it('shows the time once one is chosen', async () => {
    const prisma = make([], [{ id: 50n, serviceId: 2n, amountKobo: 3_000_000n, paidAt: paid, paymentMethod: 'MANUAL', createdAt: paid, booking: { id: 905n, availability: { startsAt: new Date('2026-11-20T10:00:00Z') } } }]);
    const r = await clientPaymentHistory(prisma, TENANT, CLIENT);
    expect(r.payments[0]).toMatchObject({ bookingId: '905', sessionAt: '2026-11-20T10:00:00.000Z' });
  });

  // Its money is on the earlier booking or the plan session's own row.
  it('never lists the no-charge booking a plan session was scheduled into', async () => {
    const prisma = make([booking({ id: 905n, paymentMethod: 'PLAN', amountKobo: 0n, paidAt: null })], []);
    const r = await clientPaymentHistory(prisma, TENANT, CLIENT);
    expect(r.payments).toEqual([]);
  });

  it('newest first, across both', async () => {
    const prisma = make(
      [booking({ createdAt: new Date('2026-11-01T10:00:00Z') })],
      [{ id: 50n, serviceId: 2n, amountKobo: 1n, paidAt: paid, paymentMethod: 'MANUAL', createdAt: new Date('2026-11-03T10:00:00Z'), booking: null }],
    );
    const r = await clientPaymentHistory(prisma, TENANT, CLIENT);
    expect(r.payments.map((p) => p.id)).toEqual(['plan-50', 'booking-900']);
  });
});
