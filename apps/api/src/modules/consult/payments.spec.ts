import { describe, it, expect, vi } from 'vitest';
import { ConsultService } from './consult.service';

/**
 * A client's own payment history.
 *
 * The amount charged was never stored: it was worked out at booking time
 * (service price minus any discount), handed to Paystack, and discarded. So a
 * payment history built from the service's price would overstate every
 * discounted booking, and would drift for every service the practice has
 * repriced since. The booking now records what was actually charged.
 */
const TENANT = 1n;
const CLIENT = 9n;

function row(over: Record<string, unknown> = {}) {
  return {
    id: 100n,
    amountKobo: 500000n,
    discountCodeUsed: null,
    status: 'CONFIRMED',
    paidAt: new Date('2026-08-01T10:00:00Z'),
    paymentRef: 'booking-100-1',
    createdAt: new Date('2026-07-30T09:00:00Z'),
    service: { title: 'Therapy', priceKobo: 800000n },
    availability: { startsAt: new Date('2026-08-05T10:00:00Z') },
    ...over,
  };
}

function makeService(rows: ReturnType<typeof row>[]) {
  const prisma: any = {
    consultBooking: { findMany: vi.fn().mockResolvedValue(rows) },
  };
  const service = new ConsultService(
    prisma, {} as any, {} as any, {} as any, {} as any, {} as any,
  );
  return { service, prisma };
}

describe('ConsultService.getClientPayments', () => {
  describe('whose payments are returned', () => {
    it('only this client, in this practice', async () => {
      const { service, prisma } = makeService([row()]);
      await service.getClientPayments(TENANT, CLIENT);
      expect(prisma.consultBooking.findMany.mock.calls[0][0].where).toMatchObject({
        tenantId: TENANT,
        clientProfileId: CLIENT,
      });
    });

    // Billing history must not be addressable by anything the caller supplies.
    it('never filters by an email or a booking id from the request', async () => {
      const { service, prisma } = makeService([row()]);
      await service.getClientPayments(TENANT, CLIENT);
      const where = prisma.consultBooking.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('client');
      expect(where).not.toHaveProperty('id');
    });
  });

  describe('the amount shown', () => {
    it('is what was charged, not what the service costs today', async () => {
      // Booked at ₦5,000 with a discount; the service now lists at ₦8,000.
      const { service } = makeService([row({ amountKobo: 500000n, discountCodeUsed: 'SAVE10' })]);
      const result = await service.getClientPayments(TENANT, CLIENT);
      expect(result.payments[0].amountKobo).toBe('500000');
    });

    it('names the discount code that was applied', async () => {
      const { service } = makeService([row({ discountCodeUsed: 'SAVE10' })]);
      const result = await service.getClientPayments(TENANT, CLIENT);
      expect(result.payments[0].discountCode).toBe('SAVE10');
    });

    // Rows written before the column existed have nothing better to fall back
    // on, and the service price is exactly right for an undiscounted booking.
    it('falls back to the service price for a booking made before amounts were recorded', async () => {
      const { service } = makeService([row({ amountKobo: null })]);
      const result = await service.getClientPayments(TENANT, CLIENT);
      expect(result.payments[0].amountKobo).toBe('800000');
    });
  });

  describe('the totals', () => {
    it('counts only what has actually been paid', async () => {
      const { service } = makeService([
        row({ id: 1n, amountKobo: 500000n, paidAt: new Date() }),
        row({ id: 2n, amountKobo: 300000n, paidAt: null, status: 'PENDING_PAYMENT' }),
      ]);
      const result = await service.getClientPayments(TENANT, CLIENT);
      expect(result.totalPaidKobo).toBe('500000');
    });

    it('shows what is still owed', async () => {
      const { service } = makeService([
        row({ id: 1n, amountKobo: 500000n, paidAt: new Date() }),
        row({ id: 2n, amountKobo: 300000n, paidAt: null, status: 'PENDING_PAYMENT' }),
      ]);
      const result = await service.getClientPayments(TENANT, CLIENT);
      expect(result.outstandingKobo).toBe('300000');
    });

    it('does not count a cancelled session as owed', async () => {
      const { service } = makeService([
        row({ id: 2n, amountKobo: 300000n, paidAt: null, status: 'CANCELLED' }),
      ]);
      const result = await service.getClientPayments(TENANT, CLIENT);
      expect(result.outstandingKobo).toBe('0');
    });

    it('adds up in kobo, so large histories do not lose precision', async () => {
      const { service } = makeService([
        row({ id: 1n, amountKobo: 900719925474099n, paidAt: new Date() }),
        row({ id: 2n, amountKobo: 1n, paidAt: new Date() }),
      ]);
      const result = await service.getClientPayments(TENANT, CLIENT);
      expect(result.totalPaidKobo).toBe('900719925474100');
    });

    it('handles a client who has never booked', async () => {
      const { service } = makeService([]);
      const result = await service.getClientPayments(TENANT, CLIENT);
      expect(result).toMatchObject({
        payments: [],
        totalPaidKobo: '0',
        outstandingKobo: '0',
      });
    });
  });

  it('returns the reference so a client can match a bank statement', async () => {
    const { service } = makeService([row({ paymentRef: 'booking-100-1725000000' })]);
    const result = await service.getClientPayments(TENANT, CLIENT);
    expect(result.payments[0].reference).toBe('booking-100-1725000000');
  });

  it('serialises every id and amount as a string, since BigInt has no JSON form', async () => {
    const { service } = makeService([row()]);
    const result = await service.getClientPayments(TENANT, CLIENT);
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
