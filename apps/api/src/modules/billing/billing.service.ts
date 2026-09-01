import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaystackService } from './paystack.service';
import { CalendarService } from '../calendar/calendar.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
    private readonly calendar: CalendarService,
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
      stripeAccountId: subaccount.stripeAccountId,
      isVerified: subaccount.isVerified,
    };
  }

  async getSubscription(tenantId: bigint) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Practice tenant not found');

    const tier = (tenant.subscriptionTier || 'STARTER').toUpperCase();
    const amounts: Record<string, string> = {
      STARTER: '₦5,000',
      PRO: '₦15,000',
      CLINIC: '₦45,000',
    };

    const nextBilling = new Date();
    nextBilling.setUTCMonth(nextBilling.getUTCMonth() + 1, 1);

    return {
      subscriptionTier: tier,
      nextChargeAmount: amounts[tier] || '₦0',
      nextBillingDate: new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(nextBilling),
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
          stripeAccountId: tenant.bankSubaccount.stripeAccountId,
        }
      : null;

    const history = [
      {
        date: tenant.updatedAt.toISOString(),
        title: `${tenant.subscriptionTier} plan active`,
        detail: `Current subscription is ${tenant.subscriptionTier}. Next charge ${subscription.nextChargeAmount} on ${subscription.nextBillingDate}.`,
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

    let paystackCode = '';
    
    try {
      const psResponse = await this.paystack.createSubaccount({
        business_name: tenant.name,
        settlement_bank: dto.bankCode,
        account_number: dto.accountNumber.trim(),
        percentage_charge: 5, // 5% platform fee for example
        description: `Subaccount for ${tenant.name}`,
      });
      
      paystackCode = psResponse.subaccount_code;
    } catch (e: any) {
      throw new BadRequestException('Failed to verify bank account with Paystack. Please check details.');
    }

    const subaccount = await this.prisma.bankSubaccount.upsert({
      where: { tenantId },
      create: {
        tenantId,
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber.trim(),
        accountName: dto.accountName.trim(),
        paystackCode,
        isVerified: true,
      },
      update: {
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber.trim(),
        accountName: dto.accountName.trim(),
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

  async updateSubscriptionPlan(tenantId: bigint, plan: 'STARTER' | 'PRO' | 'CLINIC') {
    const validPlans = ['STARTER', 'PRO', 'CLINIC'];
    if (!validPlans.includes(plan)) {
      throw new BadRequestException('Invalid subscription plan tier');
    }

    if (plan === 'STARTER') {
      const staffCount = await this.prisma.profile.count({
        where: { tenantId, role: { notIn: ['CLIENT', 'OWNER'] } },
      });
      if (staffCount > 0) {
        throw new BadRequestException('Cannot downgrade to Starter: your practice has active staff members. Remove them first.');
      }
    }

    if (plan === 'PRO' || plan === 'STARTER') {
      const therapistCount = await this.prisma.profile.count({
        where: { tenantId, role: 'THERAPIST' },
      });
      if (therapistCount > 1) {
        throw new BadRequestException('Cannot downgrade: your practice has multiple therapists. Remove them to downgrade.');
      }
    }

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionTier: plan },
    });

    return {
      tenantId: tenant.id.toString(),
      subscriptionTier: tenant.subscriptionTier,
    };
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
      stripeAccountId: tenant?.bankSubaccount?.stripeAccountId || null,
      tier,
    };
  }

  async handleWebhook(event: string, data: any) {
    if (event === 'charge.success') {
      const reference = data.reference; // 'booking-123456789'
      if (reference?.startsWith('booking-')) {
        const idStr = reference.split('-')[1];
        const bookingId = BigInt(idStr);
        
        await this.prisma.consultBooking.updateMany({
          where: { paymentRef: reference, status: 'PENDING_PAYMENT' },
          data: {
            status: 'CONFIRMED',
            paidAt: new Date(data.paid_at || Date.now()),
          },
        });
        
        await this.calendar.pushBookingToGoogle(bookingId);
      }
    }
  }
}
