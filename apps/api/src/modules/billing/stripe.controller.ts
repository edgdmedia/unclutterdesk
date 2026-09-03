import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Headers,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { authenticatedTenantId } from '../../common/authenticated-tenant';
import Stripe = require('stripe');

@ApiTags('Stripe')
@Controller('v1/stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);
  private stripe: Stripe;

  constructor(private readonly stripeService: StripeService) {
    const apiKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2026-07-29.dahlia',
    });
  }

  @Post('setup-intent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create Stripe Setup Intent for Platform Subscription' })
  async createSetupIntent(@Req() req: any) {
    return this.stripeService.createSetupIntentForPlatformSubscription(authenticatedTenantId(req));
  }

  @Post('connect-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Generate Stripe Connect Account onboarding link' })
  async createConnectAccount(@Req() req: any, @Body() body: { returnUrl: string; refreshUrl: string }) {
    if (!body.returnUrl || !body.refreshUrl) {
      throw new BadRequestException('returnUrl and refreshUrl are required');
    }
    return this.stripeService.createConnectAccountLink(authenticatedTenantId(req), body.returnUrl, body.refreshUrl);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Stripe Webhook endpoint' })
  async stripeWebhook(@Headers('stripe-signature') signature: string, @Req() req: RawBodyRequest<Request>) {
    // This endpoint is unauthenticated and mutates booking payment state, so the
    // signature is the only thing standing between it and forged payment events.
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET is not set — refusing to process webhook');
      throw new ServiceUnavailableException('Webhook processing is not configured');
    }

    if (!signature || !req.rawBody) {
      throw new BadRequestException('Missing Stripe signature or request body');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(req.rawBody, signature, endpointSecret);
    } catch (err) {
      this.logger.warn(`Rejected Stripe webhook: ${(err as Error).message}`);
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    await this.stripeService.handleWebhook(event);

    return { received: true };
  }
}
