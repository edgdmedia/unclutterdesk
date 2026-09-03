import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  Headers,
  BadRequestException,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { PaystackService } from './paystack.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { authenticatedTenantId } from '../../common/authenticated-tenant';

@ApiTags('Billing')
@Controller('v1/billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly paystackService: PaystackService,
  ) {}

  @Get('bank-subaccount')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get saved Paystack bank subaccount status' })
  getSubaccount(@Req() req: any) {
    return this.billingService.getBankSubaccount(authenticatedTenantId(req));
  }

  @Get('resolve-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Resolve Nigerian bank account name via Paystack' })
  async resolveAccount(@Req() req: any) {
    const { accountNumber, bankCode } = req.query;
    if (!accountNumber || !bankCode) {
      throw new BadRequestException('accountNumber and bankCode are required');
    }
    return this.paystackService.resolveAccountNumber(accountNumber, bankCode);
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current subscription tier summary' })
  getSubscription(@Req() req: any) {
    return this.billingService.getSubscription(authenticatedTenantId(req));
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get combined billing summary + derived history' })
  getSummary(@Req() req: any) {
    return this.billingService.getBillingSummary(authenticatedTenantId(req));
  }

  @Post('bank-subaccount')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Save bank subaccount details for split payouts' })
  saveSubaccount(@Req() req: any, @Body() dto: any) {
    return this.billingService.saveBankSubaccount(authenticatedTenantId(req), dto);
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Start a Paystack checkout for a subscription plan',
    description:
      'Returns a Paystack authorization URL. The practice tier changes only once the payment is confirmed by webhook.',
  })
  subscribe(
    @Req() req: any,
    @Body() dto: { plan: 'STARTER' | 'PRO' | 'CLINIC'; callbackUrl?: string },
  ) {
    return this.billingService.startSubscriptionCheckout(
      authenticatedTenantId(req),
      dto.plan,
      dto.callbackUrl,
    );
  }

  @Post('paystack-webhook')
  @ApiOperation({ summary: 'Paystack Webhook endpoint' })
  async paystackWebhook(
    @Headers('x-paystack-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
    @Body() body: any,
  ) {
    // Verified against the raw bytes, not the parsed body — see
    // PaystackService.verifyWebhookSignature.
    if (!this.paystackService.verifyWebhookSignature(signature, req.rawBody)) {
      throw new BadRequestException('Invalid signature');
    }

    await this.billingService.handleWebhook(body.event, body.data);
    return { status: 'success' };
  }
}

