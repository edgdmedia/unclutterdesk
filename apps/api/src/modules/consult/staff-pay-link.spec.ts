import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { payLinkToken, payLinkTokenValid } from './staff-booking-rules';
import { StaffBookingService } from './staff-booking.service';
import { tenantWebOrigin } from '../../common/origins';

const TENANT = 1n;
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);

function setup(booking: Record<string, any> | null) {
  const prisma: any = {
    consultBooking: { findFirst: vi.fn().mockResolvedValue(booking), update: vi.fn() },
  };
  const consult: any = {
    startOnlinePayment: vi.fn().mockResolvedValue({ url: 'https://checkout.paystack.com/abc', accessCode: 'ac_abc' }),
    restartOnlinePayment: vi.fn().mockResolvedValue({ paymentUrl: 'https://checkout.paystack.com/abc', accessCode: 'ac_abc', reference: 'booking-900-1', holdExpiresAt: '2026-10-06T09:05:00.000Z' }),
  };
  const service = new StaffBookingService(prisma, consult, {} as any, {} as any);
  return { service, prisma, consult };
}

const pending = {
  id: 900n,
  tenantId: TENANT,
  status: 'PENDING_PAYMENT',
  amountKobo: 2500000n,
  holdExpiresAt: inDays(1),
  service: { title: 'Therapy session', priceKobo: 3000000n },
  availability: { startsAt: inDays(4), therapist: { profile: { firstName: 'Jane', lastName: 'Smith' } } },
  client: { email: 'ada@example.com' },
  tenant: { name: 'Smith Therapy', slug: 'dr-smith', customDomain: null, customDomainStatus: null },
};

describe('the payment link token', () => {
  it('is stable for a booking and checks out', () => {
    expect(payLinkToken(900n)).toMatch(/^[0-9a-f]{32}$/);
    expect(payLinkTokenValid(900n, payLinkToken(900n))).toBe(true);
  });

  it('rejects a token made for a different booking', () => {
    expect(payLinkTokenValid(900n, payLinkToken(901n))).toBe(false);
    expect(payLinkTokenValid(900n, undefined)).toBe(false);
    expect(payLinkTokenValid(900n, 'x')).toBe(false);
  });
});

describe('opening a payment link', () => {
  it('shows what is owed, at the agreed amount', async () => {
    const { service } = setup(pending);
    const s = await service.payLinkSummary(TENANT, 900n, payLinkToken(900n));
    expect(s).toMatchObject({ state: 'PAYABLE', serviceTitle: 'Therapy session', practitionerName: 'Jane Smith', amountKobo: '2500000', practiceName: 'Smith Therapy' });
  });

  it('is not found with a bad token, the same as a missing booking', async () => {
    const { service, prisma } = setup(pending);
    await expect(service.payLinkSummary(TENANT, 900n, payLinkToken(901n))).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.consultBooking.findFirst).not.toHaveBeenCalled();
  });

  it('says it is paid, or lapsed', async () => {
    expect((await setup({ ...pending, status: 'CONFIRMED' }).service.payLinkSummary(TENANT, 900n, payLinkToken(900n))).state).toBe('PAID');
    expect((await setup({ ...pending, status: 'CANCELLED' }).service.payLinkSummary(TENANT, 900n, payLinkToken(900n))).state).toBe('LAPSED');
  });
});

describe('paying through the link', () => {
  it('restarts the checkout through the same path as the booking page (BKG-09)', async () => {
    const { service, consult } = setup(pending);
    const res = await service.payLinkCheckout(TENANT, 900n, payLinkToken(900n));
    expect(res.paymentUrl).toBe('https://checkout.paystack.com/abc');
    expect(consult.restartOnlinePayment).toHaveBeenCalledWith(TENANT, 900n, {});
  });

  it('refuses a booking that is already paid', async () => {
    const { service, consult } = setup({ ...pending, status: 'CONFIRMED' });
    await expect(service.payLinkCheckout(TENANT, 900n, payLinkToken(900n))).rejects.toThrow(/already paid/);
    expect(consult.restartOnlinePayment).not.toHaveBeenCalled();
  });

  it('refuses a booking the practice cancelled', async () => {
    const { service, consult } = setup({ ...pending, status: 'CANCELLED', holdReleasedAt: null });
    await expect(service.payLinkCheckout(TENANT, 900n, payLinkToken(900n))).rejects.toBeInstanceOf(BadRequestException);
    expect(consult.restartOnlinePayment).not.toHaveBeenCalled();
  });

  it('lets a client retry a hold that simply ran out', async () => {
    const { service, consult } = setup({ ...pending, status: 'CANCELLED', holdReleasedAt: new Date() });
    await service.payLinkCheckout(TENANT, 900n, payLinkToken(900n));
    expect(consult.restartOnlinePayment).toHaveBeenCalled();
  });
});

describe('a lapsed payment link (BKG-09)', () => {
  it('can be retried when its hold ran out and the session is still ahead', async () => {
    const s = await setup({ ...pending, status: 'CANCELLED', holdReleasedAt: new Date() }).service.payLinkSummary(TENANT, 900n, payLinkToken(900n));
    expect(s).toMatchObject({ state: 'LAPSED', canRetry: true });
  });

  it('cannot be retried when the practice cancelled it, or the session has passed', async () => {
    expect((await setup({ ...pending, status: 'CANCELLED', holdReleasedAt: null }).service.payLinkSummary(TENANT, 900n, payLinkToken(900n))).canRetry).toBe(false);
    const past = { ...pending, status: 'CANCELLED', holdReleasedAt: new Date(), availability: { ...pending.availability, startsAt: inDays(-1) } };
    expect((await setup(past).service.payLinkSummary(TENANT, 900n, payLinkToken(900n))).canRetry).toBe(false);
  });

  it('says until when a payable link holds the time', async () => {
    const s = await setup(pending).service.payLinkSummary(TENANT, 900n, payLinkToken(900n));
    expect(s.holdExpiresAt).toBe(pending.holdExpiresAt.toISOString());
  });
});
