import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';
import { BillingService } from './billing.service';
import { PaystackService } from './paystack.service';
import { BookingPaymentSettler } from './booking-payment-settler.service';
import { SUBSCRIPTION_PLANS, formatNaira } from './subscription-plans';

function makeService() {
  const prisma: any = {
    tenant: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]), update: vi.fn(), updateMany: vi.fn() },
    profile: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    consultBooking: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const paystack: any = { initializeTransaction: vi.fn() };
  const calendar: any = { pushBookingToGoogle: vi.fn().mockResolvedValue(undefined) };
  // Booking payments go through the real settler (BKG-09).
  const settler = new BookingPaymentSettler(prisma, paystack, undefined, calendar);
  return { service: new BillingService(prisma, paystack, calendar, undefined, undefined, settler), prisma, paystack };
}

describe('subscription plans', () => {
  it('derives the displayed price from the charged amount', () => {
    expect(formatNaira(SUBSCRIPTION_PLANS.PRO.amountKobo)).toBe('₦15,000');
    expect(formatNaira(SUBSCRIPTION_PLANS.CLINIC.amountKobo)).toBe('₦45,000');
  });
});

describe('BillingService.startSubscriptionCheckout', () => {
  let service: BillingService, prisma: any, paystack: any;
  const env = { ...process.env };

  beforeEach(() => {
    ({ service, prisma, paystack } = makeService());
    process.env.PAYSTACK_PLAN_PRO = 'PLN_pro123';
    prisma.tenant.findUnique.mockResolvedValue({
      id: 1n,
      publicEmail: 'practice@example.com',
      subscriptionTier: 'STARTER',
    });
    prisma.profile.findFirst.mockResolvedValue({ email: 'owner@example.com' });
    paystack.initializeTransaction.mockResolvedValue({
      authorization_url: 'https://checkout.paystack.com/abc',
    });
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('returns a Paystack checkout URL', async () => {
    const result = await service.startSubscriptionCheckout(1n, 'PRO');
    expect(result.authorizationUrl).toBe('https://checkout.paystack.com/abc');
    expect(result.reference).toMatch(/^subscription-1-\d+$/);
  });

  // The whole point of the change: this used to write the tier straight to the
  // database, so any practice could grant itself the Clinic plan for free.
  it('does not change the tier before payment', async () => {
    const result = await service.startSubscriptionCheckout(1n, 'PRO');
    expect(prisma.tenant.update).not.toHaveBeenCalled();
    expect(result.currentTier).toBe('STARTER');
  });

  it('charges the plan amount and passes the plan code so it recurs', async () => {
    await service.startSubscriptionCheckout(1n, 'PRO');
    expect(paystack.initializeTransaction.mock.calls[0][0]).toMatchObject({
      amount: SUBSCRIPTION_PLANS.PRO.amountKobo,
      plan: 'PLN_pro123',
      email: 'owner@example.com',
    });
  });

  it('falls back to the practice contact email when there is no owner', async () => {
    prisma.profile.findFirst.mockResolvedValue(null);
    await service.startSubscriptionCheckout(1n, 'PRO');
    expect(paystack.initializeTransaction.mock.calls[0][0].email).toBe('practice@example.com');
  });

  it('rejects an unknown tier', async () => {
    await expect(service.startSubscriptionCheckout(1n, 'ENTERPRISE')).rejects.toThrow(
      BadRequestException,
    );
  });

  // Better to fail loudly than to silently upgrade without charging, which is
  // exactly what the previous implementation did.
  it('refuses when the plan code is not configured', async () => {
    delete process.env.PAYSTACK_PLAN_PRO;
    await expect(service.startSubscriptionCheckout(1n, 'PRO')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(paystack.initializeTransaction).not.toHaveBeenCalled();
  });

  describe('downgrade guards still apply before payment', () => {
    it('blocks Starter while staff exist', async () => {
      process.env.PAYSTACK_PLAN_STARTER = 'PLN_starter';
      prisma.profile.count.mockResolvedValue(2);
      await expect(service.startSubscriptionCheckout(1n, 'STARTER')).rejects.toThrow(
        BadRequestException,
      );
      expect(paystack.initializeTransaction).not.toHaveBeenCalled();
    });

    it('blocks Pro while multiple therapists exist', async () => {
      prisma.profile.count.mockResolvedValue(3);
      await expect(service.startSubscriptionCheckout(1n, 'PRO')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

describe('BillingService.handleWebhook — subscriptions', () => {
  let service: BillingService, prisma: any;
  const env = { ...process.env };

  beforeEach(() => {
    ({ service, prisma } = makeService());
    process.env.PAYSTACK_PLAN_CLINIC = 'PLN_clinic';
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('activates the tier matching the plan code Paystack reports', async () => {
    await service.handleWebhook('charge.success', {
      reference: 'subscription-7-123',
      plan: { plan_code: 'PLN_clinic' },
      customer: { customer_code: 'CUS_1' },
    });

    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7n },
        data: expect.objectContaining({
          subscriptionTier: 'CLINIC',
          subscriptionStatus: 'active',
          paystackCustomerCode: 'CUS_1',
        }),
      }),
    );
  });

  // The tier comes from Paystack's payload, not the reference, so a forged
  // reference cannot select a plan the practice did not pay for.
  it('ignores a payment whose plan code is unknown', async () => {
    await service.handleWebhook('charge.success', {
      reference: 'subscription-7-123',
      plan: { plan_code: 'PLN_not_ours' },
    });
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('still confirms booking payments', async () => {
    await service.handleWebhook('charge.success', {
      reference: 'booking-42-999',
      paid_at: '2026-01-01T00:00:00Z',
    });
    expect(prisma.consultBooking.updateMany).toHaveBeenCalled();
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('flags a failed renewal without downgrading the practice', async () => {
    await service.handleWebhook('invoice.payment_failed', {
      subscription: { subscription_code: 'SUB_1' },
    });
    // Not downgraded on the spot: the paid plan runs through a grace period,
    // which starts at the first failure and is not restarted by later ones.
    const calls = prisma.tenant.updateMany.mock.calls.map((c: any) => c[0]);
    expect(calls).toContainEqual({
      where: { paystackSubscriptionCode: 'SUB_1', subscriptionPastDueAt: null },
      data: { subscriptionStatus: 'past_due', subscriptionPastDueAt: expect.any(Date) },
    });
    for (const call of calls) expect(call.data).not.toHaveProperty('subscriptionTier');
  });

  it('records a cancelled subscription', async () => {
    await service.handleWebhook('subscription.disable', { subscription_code: 'SUB_1' });
    expect(prisma.tenant.updateMany.mock.calls[0][0].data).toMatchObject({
      subscriptionStatus: 'cancelled',
    });
  });

  it('stores the subscription code and token on creation', async () => {
    await service.handleWebhook('subscription.create', {
      customer: { customer_code: 'CUS_1' },
      subscription_code: 'SUB_1',
      email_token: 'tok_1',
      next_payment_date: '2026-02-01T00:00:00Z',
    });
    expect(prisma.tenant.updateMany.mock.calls[0][0].data).toMatchObject({
      paystackSubscriptionCode: 'SUB_1',
      paystackSubscriptionToken: 'tok_1',
      subscriptionStatus: 'active',
    });
  });
});

describe('PaystackService.verifyWebhookSignature', () => {
  const SECRET = 'sk_test_secret';
  let paystack: PaystackService;

  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    paystack = new PaystackService();
    (paystack as any).secretKey = SECRET;
  });

  const sign = (raw: string) =>
    crypto.createHmac('sha512', SECRET).update(raw).digest('hex');

  it('accepts a signature over the exact raw body', () => {
    const raw = '{"event":"charge.success","data":{"reference":"booking-1"}}';
    expect(paystack.verifyWebhookSignature(sign(raw), Buffer.from(raw))).toBe(true);
  });

  // Regression: hashing JSON.stringify(parsedBody) could differ from the bytes
  // Paystack signed, rejecting valid webhooks.
  it('accepts a raw body that would not survive a parse/serialise round trip', () => {
    const raw = '{"event":"charge.success",  "data":{"amount":1.0,"note":"\\u20a6"}}';
    expect(paystack.verifyWebhookSignature(sign(raw), raw)).toBe(true);
    const reserialised = JSON.stringify(JSON.parse(raw));
    expect(reserialised).not.toBe(raw);
  });

  it('rejects a tampered body', () => {
    const raw = '{"event":"charge.success"}';
    expect(paystack.verifyWebhookSignature(sign(raw), '{"event":"charge.failed"}')).toBe(false);
  });

  it('rejects a missing signature or body', () => {
    expect(paystack.verifyWebhookSignature('', Buffer.from('{}'))).toBe(false);
    expect(paystack.verifyWebhookSignature(sign('{}'), undefined)).toBe(false);
  });

  it('rejects a signature of the wrong length without throwing', () => {
    expect(() => paystack.verifyWebhookSignature('short', Buffer.from('{}'))).not.toThrow();
    expect(paystack.verifyWebhookSignature('short', Buffer.from('{}'))).toBe(false);
  });
});

describe('lapsed subscriptions drop to FREE', () => {
  let service: BillingService, prisma: any;
  const env = { ...process.env };
  const notifications: any = { notify: vi.fn().mockResolvedValue([]) };

  beforeEach(() => {
    ({ prisma } = makeService());
    service = new BillingService(prisma, {} as any, {} as any, notifications);
    notifications.notify.mockClear();
    prisma.tenant.findUnique.mockResolvedValue({ id: 1n, subscriptionTier: 'STARTER', downgradeBlockedAt: null });
    prisma.profile.findMany.mockResolvedValue([{ id: 7n }]);
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('moves the practice to FREE when Paystack disables the subscription', async () => {
    prisma.tenant.findMany.mockResolvedValue([{ id: 1n }]);
    await service.handleWebhook('subscription.disable', { subscription_code: 'SUB_1' });
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 1n },
      data: { subscriptionTier: 'FREE', subscriptionPastDueAt: null, downgradeBlockedAt: null },
    });
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'billing.downgraded', profileIds: [7n] }));
  });

  it('honours the paid month on not_renew: only lapsed practices are looked up, by renewal date', async () => {
    const now = new Date('2026-11-10T00:00:00Z');
    await service.enforceLapsedSubscriptions(now);
    const where = prisma.tenant.findMany.mock.calls[0][0].where;
    expect(where.subscriptionTier).toEqual({ not: 'FREE' });
    expect(where.complimentaryUntil).toBeNull();
    expect(where.OR[0]).toEqual({
      subscriptionStatus: 'cancelled',
      OR: [{ subscriptionRenewsAt: null }, { subscriptionRenewsAt: { lte: now } }],
    });
  });

  it.each([
    [undefined, '2026-11-03T00:00:00.000Z'],
    ['3', '2026-11-07T00:00:00.000Z'],
  ])('past_due drops after the grace period (BILLING_GRACE_DAYS=%s)', async (grace, cutoff) => {
    if (grace) process.env.BILLING_GRACE_DAYS = grace;
    await service.enforceLapsedSubscriptions(new Date('2026-11-10T00:00:00Z'));
    const where = prisma.tenant.findMany.mock.calls[0][0].where;
    expect(where.OR[1]).toEqual({ subscriptionStatus: 'past_due', subscriptionPastDueAt: { lte: new Date(cutoff) } });
  });

  it('keeps the plan, flags it and tells the owner once when staff would be stranded', async () => {
    prisma.profile.count.mockResolvedValue(2);
    expect(await service.downgradeToFree(1n, 'payment failed')).toBe(false);
    expect(prisma.tenant.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { downgradeBlockedAt: expect.any(Date) } });
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'billing.downgrade_blocked' }));

    prisma.tenant.update.mockClear();
    notifications.notify.mockClear();
    prisma.tenant.findUnique.mockResolvedValue({ id: 1n, subscriptionTier: 'STARTER', downgradeBlockedAt: new Date() });
    expect(await service.downgradeToFree(1n, 'payment failed')).toBe(false);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('leaves a practice already on FREE alone', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: 1n, subscriptionTier: 'FREE', downgradeBlockedAt: null });
    expect(await service.downgradeToFree(1n, 'subscription ended')).toBe(false);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });
});

describe('staff counts for downgrades', () => {
  it('count only active memberships, so inactive staff never block a move to a smaller plan', async () => {
    const { service, prisma } = makeService();
    prisma.tenant.findUnique.mockResolvedValue({ id: 1n, subscriptionTier: 'PRO', downgradeBlockedAt: null });
    await service.downgradeToFree(1n, 'subscription ended');
    for (const [args] of prisma.profile.count.mock.calls) expect(args.where.status).toBe('active');
  });
});
