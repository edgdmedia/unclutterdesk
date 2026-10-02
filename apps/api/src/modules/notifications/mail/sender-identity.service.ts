import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { MailService } from './mail.service';
import { addressOf, nameOf, type Sender } from './outgoing-email';

const PLATFORM_NAME = 'Unclutter Desk';
const FALLBACK_ADDRESS = 'no-reply@unclutterdesk.com';

export interface SenderIdentity extends Sender {
  replyTo?: string;
}

/**
 * The one place that decides who an email is from, whichever provider delivers it.
 *
 * - Name: the practice's name for practice mail, otherwise the platform's.
 * - Address: the practice's own verified sending domain when the provider can
 *   sign for it (Resend can, plain SMTP can't); otherwise the platform address.
 * - Reply-To: the practice's public email, so replies reach the practice.
 *
 * The platform sender comes from MAIL_FROM (SMTP_FROM is read only when
 * MAIL_FROM is not set), its name from MAIL_FROM_NAME or the name in MAIL_FROM.
 */
@Injectable()
export class SenderIdentityService {
  private readonly logger = new Logger(SenderIdentityService.name);

  constructor(
    private readonly mail: MailService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  platformAddress(): string {
    return addressOf(process.env.MAIL_FROM || process.env.SMTP_FROM || FALLBACK_ADDRESS);
  }

  platformName(): string {
    const env = process.env;
    return (env.MAIL_FROM_NAME || env.SMTP_FROM_NAME || nameOf(env.MAIL_FROM || env.SMTP_FROM || '') || PLATFORM_NAME).trim();
  }

  async senderFor(input: { tenantId?: bigint | null; practiceName?: string | null; replyTo?: string | null }): Promise<SenderIdentity> {
    return {
      name: input.practiceName?.trim() || this.platformName(),
      address: await this.addressFor(input.tenantId),
      replyTo: input.replyTo?.trim() || undefined,
    };
  }

  private async addressFor(tenantId: bigint | null | undefined): Promise<string> {
    if (tenantId == null || !this.mail.canSignForDomains() || !this.prisma) return this.platformAddress();
    try {
      const domain = await this.prisma.tenantSendingDomain.findUnique({
        where: { tenantId },
        select: { domain: true, status: true, fromLocalPart: true },
      });
      if (domain?.status === 'VERIFIED') return `${domain.fromLocalPart}@${domain.domain}`;
    } catch (err) {
      // Never let a lookup problem stop an email; the platform address works.
      this.logger.warn(`Sending-domain lookup failed for tenant ${tenantId}: ${(err as Error).message}`);
    }
    return this.platformAddress();
  }
}
