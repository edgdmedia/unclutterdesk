import { describe, it, expect, vi } from 'vitest';
import { BillingService } from './billing.service';
import { PaystackService } from './paystack.service';
import { chargedKobo, collectedKobo } from '../../common/revenue';

/**
 * The money adds up, at every hop.
 *
 * A booking's price is settled once and then travels: into `amountKobo` on the
 * row, into a payout split, into the amount handed to Paystack, back through a
 * webhook, and out again onto the practice's dashboard and the client's
 * payments tab. Every hop is a chance for the figure to change, and the ways it
 * can change are quiet ones — a rounding rule applied in two places, a fee
 * computed twice, a discount honoured in one place and not another.
 *
 * These tests hold the chain to one number.
 */
const TENANT = 1n;

function makeBilling(tier = 'STARTER', subaccount: string | null = 'ACCT_x') {
  const prisma: any = {
    tenant: {
      findUnique: vi.fn().mockResolvedValue({
        id: TENANT,
        subscriptionTier: tier,
        bankSubaccount: subaccount ? { paystackCode: subaccount } : null,
      }),
    },
  };
  return new BillingService(prisma, {} as any, {} as any);
}

/** What paystack.service would put on the wire for this charge. */
function transactionCharge(amount: number, splitPercent?: number) {
  return splitPercent ? Math.round(amount * (splitPercent / 100)) : undefined;
}

describe('the payout split', () => {
  it('adds back up to the amount charged, exactly', async () => {
    for (const amount of [500000n, 450000n, 999999n, 1n, 33333n, 7n]) {
      const split = await makeBilling('STARTER').calculateSplitPayout(TENANT, amount);
      const total = BigInt(split.platformFeeKobo) + BigInt(split.therapistPayoutKobo);
      expect(total, `${amount} kobo did not reconcile`).toBe(amount);
    }
  });

  it('never invents or loses a kobo to rounding', async () => {
    // 5% of an odd amount rounds; the payout is the remainder, not a second
    // rounded figure, so the pair cannot drift apart.
    const split = await makeBilling('STARTER').calculateSplitPayout(TENANT, 999999n);
    expect(split.platformFeeKobo).toBe('50000');
    expect(split.therapistPayoutKobo).toBe('949999');
    expect(BigInt(split.platformFeeKobo) + BigInt(split.therapistPayoutKobo)).toBe(999999n);
  });

  it('takes five percent on the free tier', async () => {
    const split = await makeBilling('STARTER').calculateSplitPayout(TENANT, 1000000n);
    expect(split.platformFeeKobo).toBe('50000');
  });

  it('takes nothing on a paid tier', async () => {
    for (const tier of ['PRO', 'CLINIC']) {
      const split = await makeBilling(tier).calculateSplitPayout(TENANT, 1000000n);
      expect(split.platformFeeKobo, `${tier} was charged a platform fee`).toBe('0');
      expect(split.therapistPayoutKobo).toBe('1000000');
    }
  });

  it('reports the amount it was given, unchanged', async () => {
    const split = await makeBilling('PRO').calculateSplitPayout(TENANT, 450000n);
    expect(split.amountKobo).toBe('450000');
  });
});

describe('what reaches Paystack', () => {
  /*
   * The charge handed to Paystack is payout + fee. It must equal the booking's
   * own amountKobo: the client is charged the price they agreed, and the split
   * only decides who receives which part of it.
   */
  it('equals the booking amount, not the sum of two rounded halves', async () => {
    for (const amount of [500000n, 450000n, 999999n, 33333n]) {
      const split = await makeBilling('STARTER').calculateSplitPayout(TENANT, amount);
      const charge = Number(split.therapistPayoutKobo) + Number(split.platformFeeKobo);
      expect(charge, `${amount} kobo reached Paystack as ${charge}`).toBe(Number(amount));
    }
  });

  /*
   * The platform fee is worked out twice: once here, and once inside
   * paystack.service as `transaction_charge = round(amount * split / 100)`.
   * Two independent computations of the same money is how a practice ends up
   * paid a different amount from the one its dashboard reports, so they are
   * pinned to each other.
   */
  it('agrees with the transaction_charge paystack.service would send', async () => {
    for (const amount of [500000n, 450000n, 999999n, 33333n, 7n]) {
      const split = await makeBilling('STARTER').calculateSplitPayout(TENANT, amount);
      const wire = transactionCharge(Number(amount), 5);
      expect(wire, `fee disagreed at ${amount} kobo`).toBe(Number(split.platformFeeKobo));
    }
  });

  it('sends no transaction charge when the tier pays no fee', async () => {
    const split = await makeBilling('PRO').calculateSplitPayout(TENANT, 500000n);
    expect(split.platformFeeKobo).toBe('0');
    expect(transactionCharge(500000, undefined)).toBeUndefined();
  });

  it('carries the practice subaccount so the money reaches them', async () => {
    const split = await makeBilling('PRO').calculateSplitPayout(TENANT, 500000n);
    expect(split.paystackSubaccountCode).toBe('ACCT_x');
  });

  it('reports no subaccount rather than a wrong one when payouts are unset', async () => {
    const split = await makeBilling('PRO', null).calculateSplitPayout(TENANT, 500000n);
    expect(split.paystackSubaccountCode).toBeNull();
  });
});

describe('a discounted booking', () => {
  // The discount is settled before the row is written; everything downstream
  // reads amountKobo, so the discount travels with the booking.
  const discounted = { amountKobo: 450000n, paidAt: new Date(), service: { priceKobo: 800000n } };

  it('is charged the discounted price', async () => {
    const split = await makeBilling('PRO').calculateSplitPayout(TENANT, chargedKobo(discounted));
    expect(split.amountKobo).toBe('450000');
  });

  it('splits the discounted price, not the list price', async () => {
    const split = await makeBilling('STARTER').calculateSplitPayout(TENANT, chargedKobo(discounted));
    expect(BigInt(split.platformFeeKobo) + BigInt(split.therapistPayoutKobo)).toBe(450000n);
    expect(split.platformFeeKobo).toBe('22500'); // 5% of 4,500 naira
  });

  it('is reported as revenue at the discounted price', () => {
    expect(collectedKobo([discounted])).toBe(450000n);
  });
});

describe('the webhook that confirms payment', () => {
  function makeWebhook() {
    const prisma: any = {
      consultBooking: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      tenant: { findUnique: vi.fn(), update: vi.fn() },
    };
    const calendar = { pushBookingToGoogle: vi.fn().mockResolvedValue(undefined) };
    const service = new BillingService(prisma, {} as any, calendar as any);
    return { service, prisma };
  }

  it('confirms only the booking named in the reference', async () => {
    const { service, prisma } = makeWebhook();
    await service.handleWebhook('charge.success', { reference: 'booking-100-1', paid_at: null });
    expect(prisma.consultBooking.updateMany.mock.calls[0][0].where).toMatchObject({
      paymentRef: 'booking-100-1',
    });
  });

  /*
   * The status is part of the match, so a replayed webhook — Paystack retries,
   * and the endpoint is reachable by anyone who can forge a signature-checked
   * body — cannot confirm a booking twice or resurrect a cancelled one.
   */
  it('touches only a booking still awaiting payment', async () => {
    const { service, prisma } = makeWebhook();
    await service.handleWebhook('charge.success', { reference: 'booking-100-1' });
    expect(prisma.consultBooking.updateMany.mock.calls[0][0].where.status).toBe('PENDING_PAYMENT');
  });

  it('records when Paystack says it was paid, not when we processed it', async () => {
    const { service, prisma } = makeWebhook();
    const paidAt = '2026-09-01T10:00:00.000Z';
    await service.handleWebhook('charge.success', { reference: 'booking-100-1', paid_at: paidAt });
    expect(prisma.consultBooking.updateMany.mock.calls[0][0].data.paidAt).toEqual(new Date(paidAt));
  });

  it('sets a payment date even when Paystack omits one, so revenue can see it', async () => {
    const { service, prisma } = makeWebhook();
    await service.handleWebhook('charge.success', { reference: 'booking-100-1' });
    expect(prisma.consultBooking.updateMany.mock.calls[0][0].data.paidAt).toBeInstanceOf(Date);
  });

  it('ignores an event that is not a successful charge', async () => {
    const { service, prisma } = makeWebhook();
    await service.handleWebhook('charge.failed', { reference: 'booking-100-1' });
    expect(prisma.consultBooking.updateMany).not.toHaveBeenCalled();
  });

  it('ignores a reference that names no booking', async () => {
    const { service, prisma } = makeWebhook();
    await service.handleWebhook('charge.success', { reference: 'something-else' });
    expect(prisma.consultBooking.updateMany).not.toHaveBeenCalled();
  });
});

describe('the figure the practice sees', () => {
  // The dashboard, the client's payments tab and the payout split must all be
  // reading the same number for the same booking.
  const booking = { amountKobo: 450000n, paidAt: new Date(), service: { priceKobo: 800000n } };

  it('is the figure that was split and charged', async () => {
    const split = await makeBilling('PRO').calculateSplitPayout(TENANT, chargedKobo(booking));
    expect(split.amountKobo).toBe(collectedKobo([booking]).toString());
  });

  it('counts nothing for a booking that was never paid', () => {
    expect(collectedKobo([{ ...booking, paidAt: null }])).toBe(0n);
  });
});
