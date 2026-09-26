import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaystackService } from './paystack.service';
import { BillingService } from './billing.service';
import { ConsultService } from '../consult/consult.service';

/**
 * The practice's payout subaccount: created by the platform on Paystack when
 * the practice saves its bank account, and used to split every booking.
 */
afterEach(() => vi.unstubAllGlobals());

function stubFetch(data: unknown = { authorization_url: 'https://checkout' }, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => (ok ? { data } : data) });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const body = (fetchMock: any) => JSON.parse(fetchMock.mock.calls[0][1].body);

describe('the platform fee on a booking payment', () => {
  // Older subaccounts carry percentage_charge 5; without an explicit 0 Paystack
  // applied it, charging Pro and Clinic practices a fee they were promised 0%.
  it('sends an explicit 0 on Pro and Clinic', async () => {
    const fetchMock = stubFetch();
    await new PaystackService().initializeTransaction({ amount: 2_500_000, email: 'a@b.ng', reference: 'r', subaccount: 'ACCT_x', split: 0 });
    expect(body(fetchMock).transaction_charge).toBe(0);
  });

  it('takes 5% on Starter', async () => {
    const fetchMock = stubFetch();
    await new PaystackService().initializeTransaction({ amount: 2_500_000, email: 'a@b.ng', reference: 'r', subaccount: 'ACCT_x', split: 5 });
    expect(body(fetchMock).transaction_charge).toBe(125_000);
  });
});

describe('saving a payout account', () => {
  function billing() {
    const prisma: any = {
      tenant: { findUnique: vi.fn().mockResolvedValue({ id: 1n, name: 'Calm' }) },
      bankSubaccount: { upsert: vi.fn(({ create }: any) => ({ id: 1n, ...create })) },
    };
    const paystack: any = {
      resolveAccountNumber: vi.fn().mockResolvedValue({ account_name: 'CALM PRACTICE LTD' }),
      createSubaccount: vi.fn().mockResolvedValue({ subaccount_code: 'ACCT_new' }),
    };
    return { prisma, paystack, service: new BillingService(prisma, paystack, {} as any) };
  }

  it('creates the subaccount with no fee of its own, and stores the name Paystack resolved', async () => {
    const { prisma, paystack, service } = billing();
    await service.saveBankSubaccount(1n, { bankCode: '058', bankName: 'GTBank', accountNumber: '0123456789', accountName: 'typed name' });
    expect(paystack.createSubaccount.mock.calls[0][0].percentage_charge).toBe(0);
    expect(prisma.bankSubaccount.upsert.mock.calls[0][0].create).toMatchObject({ accountName: 'CALM PRACTICE LTD', paystackCode: 'ACCT_new', isVerified: true });
  });

  it('refuses an account Paystack cannot find', async () => {
    const { paystack, service } = billing();
    paystack.resolveAccountNumber.mockRejectedValue(new Error('Could not resolve account name'));
    await expect(service.saveBankSubaccount(1n, { bankCode: '058', bankName: 'GTBank', accountNumber: '0123456789', accountName: 'x' })).rejects.toThrow(/could not find that account/);
    expect(paystack.createSubaccount).not.toHaveBeenCalled();
  });
});

describe('a subaccount Paystack rejects', () => {
  function consult({ broken = false, rejects = true } = {}) {
    const prisma: any = {
      consultBooking: {
        findFirst: vi.fn().mockResolvedValue({ id: 7n, amountKobo: 2_500_000n, service: { priceKobo: 2_500_000n }, client: { email: 'c@x.ng' } }),
        update: vi.fn(),
      },
      tenant: { findUnique: vi.fn().mockResolvedValue({ slug: 'calm', customDomain: null, customDomainStatus: null }) },
    };
    const billing: any = {
      calculateSplitPayout: vi.fn().mockResolvedValue({ therapistPayoutKobo: '2500000', platformFeeKobo: '0', paystackSubaccountCode: 'ACCT_old', tier: 'PRO', payoutAccountBroken: broken }),
      payoutAccountRejected: vi.fn().mockResolvedValue("Online payment isn't available for this practice right now."),
    };
    const paystack: any = {
      initializeTransaction: rejects ? vi.fn().mockRejectedValue(new Error('Invalid Subaccount')) : vi.fn().mockResolvedValue({ authorization_url: 'u' }),
    };
    const service = new ConsultService(prisma, {} as any, {} as any, billing, paystack, {} as any, {} as any);
    return { service, prisma, billing, paystack };
  }

  it('tells the practice and gives the client a plain message', async () => {
    const { service, billing, prisma } = consult();
    await expect(service.getBookingPaymentUrl(1n, 7n, 'c@x.ng')).rejects.toThrow(/isn't available for this practice/);
    expect(billing.payoutAccountRejected).toHaveBeenCalledWith(1n, 'Invalid Subaccount');
    // A failed attempt does not overwrite the reference of an earlier one.
    expect(prisma.consultBooking.update).not.toHaveBeenCalled();
  });

  // Charging without the subaccount would send the practice's money to the platform.
  it('does not try again, or charge without it, once flagged', async () => {
    const { service, paystack } = consult({ broken: true });
    await expect(service.getBookingPaymentUrl(1n, 7n, 'c@x.ng')).rejects.toThrow(/isn't available/);
    expect(paystack.initializeTransaction).not.toHaveBeenCalled();
  });

  it('flags the account and notifies owners and admins only once', async () => {
    const prisma: any = {
      bankSubaccount: { findUnique: vi.fn().mockResolvedValue({ isVerified: true }), update: vi.fn() },
      profile: { findMany: vi.fn().mockResolvedValue([{ id: 2n }]) },
    };
    const notifications: any = { notify: vi.fn() };
    const service = new BillingService(prisma, {} as any, {} as any, notifications);
    await service.payoutAccountRejected(1n, 'Invalid Subaccount');
    expect(prisma.bankSubaccount.update.mock.calls[0][0].data).toEqual({ isVerified: false });
    expect(notifications.notify.mock.calls[0][0]).toMatchObject({ profileIds: [2n], link: '/dashboard/settings/payouts' });

    prisma.bankSubaccount.findUnique.mockResolvedValue({ isVerified: false });
    await service.payoutAccountRejected(1n, 'Invalid Subaccount');
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });
});
