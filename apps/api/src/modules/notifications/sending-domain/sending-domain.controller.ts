import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Patch,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../../common/roles.guard';
import { PRACTICE_ADMIN, Roles } from '../../../common/roles';
import { authenticatedTenantId } from '../../../common/authenticated-tenant';
import { verifyResendWebhook } from '../mail/webhook-signature';
import { SendingDomainService } from './sending-domain.service';

@ApiTags('Sending domain')
@Controller('v1/tenant/sending-domain')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class SendingDomainController {
  constructor(private readonly sendingDomains: SendingDomainService) {}

  @Roles(...PRACTICE_ADMIN)
  @Get()
  @ApiOperation({ summary: "The practice's own email domain, its DNS records and status" })
  get(@Req() req: any) {
    return this.sendingDomains.get(authenticatedTenantId(req));
  }

  @Roles(...PRACTICE_ADMIN)
  @Post()
  @ApiOperation({ summary: 'Start sending from a domain the practice owns' })
  register(@Req() req: any, @Body() dto: { domain?: string; fromLocalPart?: string }) {
    return this.sendingDomains.register(authenticatedTenantId(req), dto ?? {});
  }

  @Roles(...PRACTICE_ADMIN)
  @Post('verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Re-check the DNS records for the sending domain' })
  verify(@Req() req: any) {
    return this.sendingDomains.verify(authenticatedTenantId(req));
  }

  @Roles(...PRACTICE_ADMIN)
  @Patch()
  @ApiOperation({ summary: 'Change the part of the sender address before the @' })
  updateSender(@Req() req: any, @Body() dto: { fromLocalPart?: string }) {
    return this.sendingDomains.updateSender(authenticatedTenantId(req), dto ?? {});
  }

  @Roles(...PRACTICE_ADMIN)
  @Delete()
  @ApiOperation({ summary: 'Stop sending from the practice domain' })
  remove(@Req() req: any) {
    return this.sendingDomains.remove(authenticatedTenantId(req));
  }
}

/** Resend's webhooks. Public, but only accepted with a valid signature. */
@ApiTags('Webhooks')
@Controller('v1/webhooks')
export class ResendWebhookController {
  constructor(private readonly sendingDomains: SendingDomainService) {}

  @Post('resend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resend webhook (domain status changes)' })
  async resend(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') id: string,
    @Headers('svix-timestamp') timestamp: string,
    @Headers('svix-signature') signature: string,
    @Body() body: any,
  ) {
    const secret = process.env.RESEND_WEBHOOK_SECRET || '';
    const raw = req.rawBody ? req.rawBody.toString('utf8') : '';
    if (!verifyResendWebhook(raw, { id, timestamp, signature }, secret)) {
      throw new BadRequestException('Invalid signature');
    }
    return this.sendingDomains.handleWebhook(body);
  }
}
