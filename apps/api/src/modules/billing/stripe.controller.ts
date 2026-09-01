import { Controller, Post, Body, Req, UseGuards, Headers, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { authenticatedTenantId } from '../../common/authenticated-tenant';
import Stripe = require('stripe');

@ApiTags('Stripe')
@Controller('v1/stripe')
export class StripeController {
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
  async stripeWebhook(@Headers('stripe-signature') signature: string, @Body() payload: any) {
    // In production, we should use raw body to verify signature:
    // const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    // let event;
    // try {
    //   event = this.stripe.webhooks.constructEvent(req.rawBody, signature, endpointSecret);
    // } catch (err) {
    //   throw new BadRequestException(`Webhook Error: ${err.message}`);
    // }
    
    const event = payload; // Assuming payload is already parsed JSON for now
    await this.stripeService.handleWebhook(event);

    return { received: true };
  }
}
