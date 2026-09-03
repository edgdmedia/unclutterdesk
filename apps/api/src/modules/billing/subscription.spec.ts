import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';
import { BillingService } from './billing.service';
import { PaystackService } from './paystack.service';
import { SUBSCRIPTION_PLANS, formatNaira } from './subscription-plans';

function makeService() {
  const prisma: any = {
    tenant: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    profile: { findFirst: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    consultBooking: { updateMany: vi.fn() },
  };
  const paystack: any = { initializeTransaction: vi.fn() };
  const calendar: any = { pushBookingToGoogle: vi.fn() };
  return { service: new BillingService(prisma, paystack, calendar), prisma, paystack };
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
    // Losing access to clinical records over a failed card is worse than a
    // month of unpaid service.
    const call = prisma.tenant.updateMany.mock.calls[0][0];
    expect(call.data).toEqual({ subscriptionStatus: 'past_due' });
    expect(call.data).not.toHaveProperty('subscriptionTier');
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
