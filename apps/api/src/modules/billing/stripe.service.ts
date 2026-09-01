import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CalendarService } from '../calendar/calendar.service';
import Stripe = require('stripe');

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: CalendarService,
  ) {
    const apiKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2026-07-29.dahlia',
    });
  }

  // 1. Platform Subscription: Create Customer & Setup Intent
  async createSetupIntentForPlatformSubscription(tenantId: bigint) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');

    let customerId = tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        name: tenant.name,
        metadata: { tenantId: tenantId.toString() },
      });
      customerId = customer.id;
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeCustomerId: customerId },
      });
    }

    const setupIntent = await this.stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: { tenantId: tenantId.toString(), purpose: 'subscription' },
    });

    return {
      clientSecret: setupIntent.client_secret,
      customerId,
    };
  }

  // 2. Stripe Connect: Create Account Link for Payouts
  async createConnectAccountLink(tenantId: bigint, returnUrl: string, refreshUrl: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { bankSubaccount: true },
    });
    if (!tenant) throw new BadRequestException('Tenant not found');

    let accountId = tenant.bankSubaccount?.stripeAccountId;
    if (!accountId) {
      const account = await this.stripe.accounts.create({
        type: 'standard',
        email: tenant.publicEmail || undefined,
        business_profile: {
          name: tenant.name,
        },
        metadata: { tenantId: tenantId.toString() },
      });
      accountId = account.id;

      if (tenant.bankSubaccount) {
        await this.prisma.bankSubaccount.update({
          where: { tenantId },
          data: { stripeAccountId: accountId },
        });
      } else {
        await this.prisma.bankSubaccount.create({
          data: {
            tenantId,
            bankCode: 'STRIPE',
            bankName: 'Stripe',
            accountNumber: 'STRIPE',
            accountName: tenant.name,
            stripeAccountId: accountId,
          },
        });
      }
    }

    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return { url: accountLink.url };
  }

  // 3. Client Bookings: Create Checkout Session routing funds to Connect Account
  async createCheckoutSession(bookingId: bigint, amountKobo: bigint, applicationFeeKobo: bigint, connectedAccountId: string, successUrl: string, clientEmail: string, serviceTitle: string) {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'ngn',
            product_data: {
              name: serviceTitle,
            },
            unit_amount: Number(amountKobo),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      customer_email: clientEmail,
      payment_intent_data: {
        application_fee_amount: Number(applicationFeeKobo),
        transfer_data: {
          destination: connectedAccountId,
        },
      },
      metadata: { bookingId: bookingId.toString() },
    });

    return { url: session.url };
  }

  async handleWebhook(event: any) {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingIdStr = session.metadata?.bookingId;
      
      if (bookingIdStr) {
        const bookingId = BigInt(bookingIdStr);
        
        await this.prisma.consultBooking.updateMany({
          where: { id: bookingId, status: 'PENDING_PAYMENT' },
          data: {
            status: 'CONFIRMED',
            paidAt: new Date(),
          },
        });
        
        await this.calendar.pushBookingToGoogle(bookingId);
      }
    }
  }
}
