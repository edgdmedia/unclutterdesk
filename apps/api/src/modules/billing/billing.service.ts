import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
  isSubscriptionTier,
  formatNaira,
  planCodeFor,
} from './subscription-plans';
import { PaystackService } from './paystack.service';
import { CalendarService } from '../calendar/calendar.service';
import { NotificationService } from '../notifications/notification.service';
import { appOrigin } from '../../common/origins';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
    private readonly calendar: CalendarService,
    @Optional() private readonly notifications?: NotificationService,
  ) {}

  async getBankSubaccount(tenantId: bigint) {
    const subaccount = await this.prisma.bankSubaccount.findUnique({
      where: { tenantId },
    });

    if (!subaccount) return null;

    return {
      id: subaccount.id.toString(),
      bankCode: subaccount.bankCode,
      bankName: subaccount.bankName,
      accountNumber: subaccount.accountNumber,
      accountName: subaccount.accountName,
      paystackCode: subaccount.paystackCode,
      isVerified: subaccount.isVerified,
    };
  }

  /**
   * The plans, priced from the same definitions the charge is built from.
   *
   * The upgrade page hardcoded its own prices and got all three wrong: it
   * offered Pro at ₦25,000 and Group Clinic at ₦75,000 while Paystack was
   * charging ₦15,000 and ₦45,000, and showed Starter as free when it is not.
   * A price quoted on the button someone clicks to buy has to be the price
   * they are charged, so it is no longer restated anywhere.
   */
  listPlans() {
    return SUBSCRIPTION_TIERS.map((tier) => {
      const plan = SUBSCRIPTION_PLANS[tier];
      return {
        tier,
        name: plan.name,
        amountKobo: plan.amountKobo,
        price: formatNaira(plan.amountKobo),
      };
    });
  }

  async getSubscription(tenantId: bigint) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Practice tenant not found');

    const tier = (tenant.subscriptionTier || 'STARTER').toUpperCase();
    const plan = isSubscriptionTier(tier) ? SUBSCRIPTION_PLANS[tier] : null;

    // Paystack drives the renewal date once a subscription exists. Before the
    // first payment there is nothing to report, so this no longer invents a
    // date the practice will not actually be charged on.
    return {
      subscriptionTier: tier,
      subscriptionStatus: tenant.subscriptionStatus ?? 'unpaid',
      // Set while the plan comes from an invite code; it ends on this date.
      complimentaryUntil: tenant.complimentaryUntil?.toISOString() ?? null,
      nextChargeAmount: plan ? formatNaira(plan.amountKobo) : '₦0',
      nextBillingDate: tenant.subscriptionRenewsAt
        ? new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }).format(tenant.subscriptionRenewsAt)
        : null,
    };
  }

  async getBillingSummary(tenantId: bigint) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { bankSubaccount: true },
    });
    if (!tenant) throw new NotFoundException('Practice tenant not found');

    const subscription = await this.getSubscription(tenantId);
    const bankSubaccount = tenant.bankSubaccount
      ? {
          bankCode: tenant.bankSubaccount.bankCode,
          bankName: tenant.bankSubaccount.bankName,
          accountNumber: tenant.bankSubaccount.accountNumber,
          accountName: tenant.bankSubaccount.accountName,
          isVerified: tenant.bankSubaccount.isVerified,
        }
      : null;

    const history = [
      {
        date: tenant.updatedAt.toISOString(),
        title: `${tenant.subscriptionTier} plan active`,
        detail: tenant.complimentaryUntil
          ? `${tenant.subscriptionTier} from an invite code, free until ${tenant.complimentaryUntil.toISOString().slice(0, 10)}.`
          : subscription.nextBillingDate
            ? `Current subscription is ${tenant.subscriptionTier}. Next charge ${subscription.nextChargeAmount} on ${subscription.nextBillingDate}.`
            : `Current plan is ${tenant.subscriptionTier}. No payment has been taken yet.`,
        type: 'subscription',
      },
      ...(tenant.bankSubaccount
        ? [
            {
              date: tenant.bankSubaccount.updatedAt.toISOString(),
              title: 'Payout account saved',
              detail: `${tenant.bankSubaccount.bankName} ending ${tenant.bankSubaccount.accountNumber.slice(-4)} is ${tenant.bankSubaccount.isVerified ? 'verified' : 'pending verification'}.`,
              type: 'payout',
            },
          ]
        : []),
      {
        date: tenant.createdAt.toISOString(),
        title: 'Practice billing profile created',
        detail: 'Billing and subscription tracking started for this practice.',
        type: 'system',
      },
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let currentMonthBookings = 0;
    if (subscription.subscriptionTier === 'STARTER') {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      currentMonthBookings = await this.prisma.consultBooking.count({
        where: { tenantId, createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
      });
    }

    const [staffCount, therapistCount] = await Promise.all([
      this.prisma.profile.count({
        where: { tenantId, role: { notIn: ['CLIENT', 'OWNER'] } },
      }),
      this.prisma.profile.count({
        where: { tenantId, role: 'THERAPIST' },
      }),
    ]);

    const canDowngradeToStarter = staffCount === 0;
    const canDowngradeToPro = therapistCount <= 1;

    return {
      subscription: {
        ...subscription,
        currentMonthBookings,
        canDowngradeToStarter,
        canDowngradeToPro,
        starterBlockReason: canDowngradeToStarter
          ? null
          : 'Remove active staff members before downgrading to Starter.',
        proBlockReason: canDowngradeToPro
          ? null
          : 'Group practices with multiple therapists require the Clinic plan.',
      },
      bankSubaccount,
      history,
    };
  }

  async saveBankSubaccount(tenantId: bigint, dto: {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) {
    if (!dto.accountNumber || !dto.bankCode || !dto.accountName) {
      throw new BadRequestException('Complete bank account details are required');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Practice tenant not found');

    const accountNumber = dto.accountNumber.trim();
    if (!/^\d{10}$/.test(accountNumber)) throw new BadRequestException('Enter the 10-digit account number.');

    // Paystack confirms the account exists and whose it is; that name is what
    // gets stored, not whatever was typed.
    let accountName = dto.accountName.trim();
    try {
      const resolved = await this.paystack.resolveAccountNumber(accountNumber, dto.bankCode);
      if (resolved?.account_name) accountName = resolved.account_name;
    } catch {
      throw new BadRequestException('Paystack could not find that account at that bank. Check the bank and account number.');
    }

    let paystackCode = '';
    try {
      const psResponse = await this.paystack.createSubaccount({
        business_name: tenant.name,
        settlement_bank: dto.bankCode,
        account_number: accountNumber,
        // 0: the platform fee is set on each transaction (5% on Starter, 0% on
        // Pro and Clinic), never by the subaccount.
        percentage_charge: 0,
        description: `Subaccount for ${tenant.name}`,
      });
      paystackCode = psResponse.subaccount_code;
    } catch (e: any) {
      throw new BadRequestException(`Paystack could not set up payouts to this account: ${e?.message ?? 'unknown error'}`);
    }

    const subaccount = await this.prisma.bankSubaccount.upsert({
      where: { tenantId },
      create: {
        tenantId,
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        accountNumber,
        accountName,
        paystackCode,
        isVerified: true,
      },
      update: {
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        accountNumber,
        accountName,
        paystackCode,
        isVerified: true,
      },
    });

    return {
      id: subaccount.id.toString(),
      bankName: subaccount.bankName,
      accountNumber: subaccount.accountNumber,
      accountName: subaccount.accountName,
      paystackCode: subaccount.paystackCode,
      isVerified: subaccount.isVerified,
    };
  }

  /**
   * Guards that have nothing to do with payment: a practice cannot drop to a
   * tier that cannot hold the staff it already has.
   */
  private async assertDowngradeAllowed(tenantId: bigint, plan: SubscriptionTier) {
    if (plan === 'STARTER') {
      const staffCount = await this.prisma.profile.count({
        where: { tenantId, role: { notIn: ['CLIENT', 'OWNER'] } },
      });
      if (staffCount > 0) {
        throw new BadRequestException(
          'Cannot downgrade to Starter: your practice has active staff members. Remove them first.',
        );
      }
    }

    if (plan === 'PRO' || plan === 'STARTER') {
      const therapistCount = await this.prisma.profile.count({
        where: { tenantId, role: 'THERAPIST' },
      });
      if (therapistCount > 1) {
        throw new BadRequestException(
          'Cannot downgrade: your practice has multiple therapists. Remove them to downgrade.',
        );
      }
    }
  }

  /**
   * Begins a plan change by sending the practice to Paystack.
   *
   * This previously wrote the new tier straight to the database and returned,
   * so any practice could grant itself the Clinic plan for free. The tier now
   * changes only when Paystack confirms payment, in `handleWebhook`.
   */
  async startSubscriptionCheckout(tenantId: bigint, plan: string) {
    if (!isSubscriptionTier(plan)) {
      throw new BadRequestException('Invalid subscription plan tier');
    }

    await this.assertDowngradeAllowed(tenantId, plan);

    const planCode = planCodeFor(plan);
    if (!planCode) {
      // Failing loudly beats silently upgrading without charging, which is what
      // the previous implementation effectively did.
      this.logger.error(
        `${SUBSCRIPTION_PLANS[plan].planCodeEnv} is not set — cannot start a subscription`,
      );
      throw new ServiceUnavailableException(
        'Subscription billing is not configured. Please contact support.',
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, publicEmail: true, subscriptionTier: true },
    });
    if (!tenant) throw new NotFoundException('Practice tenant not found');

    const owner = await this.prisma.profile.findFirst({
      where: { tenantId, role: 'OWNER' },
      select: { email: true },
    });

    const email = owner?.email || tenant.publicEmail;
    if (!email) {
      throw new BadRequestException(
        'Add an owner or practice contact email before subscribing.',
      );
    }

    const reference = `subscription-${tenantId}-${Date.now()}`;
    const definition = SUBSCRIPTION_PLANS[plan];

    try {
      const transaction = await this.paystack.initializeTransaction({
        amount: definition.amountKobo,
        email,
        reference,
        plan: planCode,
        // Built here, never accepted from the caller: whoever controls this
        // value controls where a paying customer lands afterwards.
        callback_url: `${appOrigin()}/dashboard/settings/subscription`,
      });

      return {
        authorizationUrl: transaction.authorization_url,
        reference,
        plan,
        amount: formatNaira(definition.amountKobo),
        // The tier is unchanged until Paystack confirms; say so plainly rather
        // than letting the client assume the upgrade already happened.
        currentTier: tenant.subscriptionTier,
        message: 'Complete payment to activate this plan.',
      };
    } catch (error) {
      this.logger.error(`Failed to start subscription checkout for tenant ${tenantId}`, error as Error);
      throw new BadRequestException('Could not start subscription payment. Please try again.');
    }
  }

  /** Applied only from a signature-verified Paystack webhook. */
  private async applyPaidSubscription(
    tenantId: bigint,
    plan: SubscriptionTier,
    data: any,
  ) {
    const renewsAt = new Date();
    renewsAt.setUTCMonth(renewsAt.getUTCMonth() + 1);

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionTier: plan,
        subscriptionStatus: 'active',
        subscriptionRenewsAt: renewsAt,
        // Paying now: any invite period is superseded, and must not later
        // be "ended" by moving the practice back to Starter.
        complimentaryUntil: null,
        ...(data?.customer?.customer_code
          ? { paystackCustomerCode: data.customer.customer_code }
          : {}),
      },
    });

    this.logger.log(`Tenant ${tenantId} subscription activated on ${plan}`);
  }

  /**
   * Paystack refused the practice's payout subaccount (deleted, or created
   * with a different Paystack key). Flag it so the Payouts page asks for the
   * account again, and tell the people who can fix it. Returns the message
   * for the client, who cannot.
   */
  async payoutAccountRejected(tenantId: bigint, reason: string): Promise<string> {
    try {
      const account = await this.prisma.bankSubaccount.findUnique({ where: { tenantId } });
      if (account?.isVerified) {
        await this.prisma.bankSubaccount.update({ where: { tenantId }, data: { isVerified: false } });
        const leads = await this.prisma.profile.findMany({
          where: { tenantId, role: { in: ['OWNER', 'ADMIN'] }, status: 'active' },
          select: { id: true },
        });
        if (leads.length) {
          await this.notifications?.notify({
            tenantId,
            profileIds: leads.map((l) => l.id),
            type: 'billing.payout_account_invalid',
            title: 'Clients cannot pay online: re-add your payout account',
            message: `Paystack rejected your payout account (${reason}). Add it again under Settings → Payouts so clients can pay.`,
            link: '/dashboard/settings/payouts',
            actionLabel: 'Fix payouts',
            channels: { in_app: true, email: true, push: true },
          });
        }
      }
    } catch (err) {
      this.logger.warn(`Could not flag payout account for tenant ${tenantId}: ${(err as Error).message}`);
    }
    return "Online payment isn't available for this practice right now. The practice has been told; please try again later or contact them.";
  }

  async calculateSplitPayout(tenantId: bigint, amountKobo: bigint) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { bankSubaccount: true },
    });

    const tier = (tenant?.subscriptionTier || 'STARTER').toUpperCase();
    
    // Fee Structure: STARTER = 5% platform fee; PRO & CLINIC = 0% platform fee
    const platformPercentage = tier === 'STARTER' ? 0.05 : 0;
    const platformFeeKobo = BigInt(Math.round(Number(amountKobo) * platformPercentage));
    const therapistPayoutKobo = amountKobo - platformFeeKobo;

    return {
      amountKobo: amountKobo.toString(),
      platformFeeKobo: platformFeeKobo.toString(),
      therapistPayoutKobo: therapistPayoutKobo.toString(),
      paystackSubaccountCode: tenant?.bankSubaccount?.paystackCode || null,
      // Rejected by Paystack before: charging without it would send the
      // practice's money to the platform account instead.
      payoutAccountBroken: Boolean(tenant?.bankSubaccount && !tenant.bankSubaccount.isVerified),
      tier,
    };
  }

  async handleWebhook(event: string, data: any) {
    const reference: string | undefined = data?.reference;

    if (event === 'charge.success' && reference?.startsWith('booking-')) {
      const bookingId = BigInt(reference.split('-')[1]);

      await this.prisma.consultBooking.updateMany({
        where: { paymentRef: reference, status: 'PENDING_PAYMENT' },
        data: {
          status: 'CONFIRMED',
          paidAt: new Date(data.paid_at || Date.now()),
        },
      });

      await this.calendar.pushBookingToGoogle(bookingId);
      return;
    }

    // Platform subscription payments. The reference carries the tenant, and the
    // plan is read back from Paystack's own payload rather than anything the
    // caller supplied, so a forged reference cannot select a tier.
    if (event === 'charge.success' && reference?.startsWith('subscription-')) {
      const tenantId = BigInt(reference.split('-')[1]);
      const planCode: string | undefined = data?.plan?.plan_code ?? data?.plan_object?.plan_code;

      const tier = (Object.keys(SUBSCRIPTION_PLANS) as SubscriptionTier[]).find(
        (t) => planCodeFor(t) === planCode,
      );

      if (!tier) {
        this.logger.error(
          `Subscription payment ${reference} referenced unknown plan code ${planCode}; tier not changed`,
        );
        return;
      }

      await this.applyPaidSubscription(tenantId, tier, data);
      return;
    }

    if (event === 'subscription.create') {
      const customerCode: string | undefined = data?.customer?.customer_code;
      if (!customerCode) return;

      await this.prisma.tenant.updateMany({
        where: { paystackCustomerCode: customerCode },
        data: {
          paystackSubscriptionCode: data?.subscription_code ?? null,
          paystackSubscriptionToken: data?.email_token ?? null,
          subscriptionStatus: 'active',
          ...(data?.next_payment_date
            ? { subscriptionRenewsAt: new Date(data.next_payment_date) }
            : {}),
        },
      });
      return;
    }

    if (event === 'invoice.payment_failed') {
      const code: string | undefined = data?.subscription?.subscription_code;
      if (!code) return;
      // Flagged, not downgraded: losing access to clinical records over a failed
      // card is a worse outcome than a month of unpaid service.
      await this.prisma.tenant.updateMany({
        where: { paystackSubscriptionCode: code },
        data: { subscriptionStatus: 'past_due' },
      });
      this.logger.warn(`Subscription ${code} marked past_due after a failed payment`);
      return;
    }

    if (event === 'subscription.disable' || event === 'subscription.not_renew') {
      const code: string | undefined = data?.subscription_code;
      if (!code) return;
      await this.prisma.tenant.updateMany({
        where: { paystackSubscriptionCode: code },
        data: { subscriptionStatus: 'cancelled' },
      });
      return;
    }
  }
}
