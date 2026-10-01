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
  const consult: any = { startOnlinePayment: vi.fn().mockResolvedValue({ url: 'https://checkout.paystack.com/abc', accessCode: 'ac_abc' }) };
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
  it('starts a fresh checkout for the agreed amount and records its reference', async () => {
    const { service, consult, prisma } = setup(pending);
    const res = await service.payLinkCheckout(TENANT, 900n, payLinkToken(900n));
    expect(res.paymentUrl).toBe('https://checkout.paystack.com/abc');
    const [tenantId, amount, email, reference, callback] = consult.startOnlinePayment.mock.calls[0];
    expect([tenantId, amount, email]).toEqual([TENANT, 2500000n, 'ada@example.com']);
    expect(reference).toMatch(/^booking-900-\d+$/);
    expect(callback).toBe(`${tenantWebOrigin(pending.tenant)}/booking/confirmed`);
    expect(prisma.consultBooking.update).toHaveBeenCalledWith({ where: { id: 900n }, data: { paymentRef: reference } });
  });

  it('refuses a booking that is not waiting for payment', async () => {
    const { service, consult } = setup({ ...pending, status: 'CONFIRMED' });
    await expect(service.payLinkCheckout(TENANT, 900n, payLinkToken(900n))).rejects.toBeInstanceOf(BadRequestException);
    expect(consult.startOnlinePayment).not.toHaveBeenCalled();
  });
});
