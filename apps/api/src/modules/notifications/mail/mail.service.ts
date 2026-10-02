import { Injectable, Logger } from '@nestjs/common';
import { ResendClient } from './resend.client';
import type { OutgoingEmail } from './outgoing-email';
import type { MailTransport, ProviderKey } from './transports/mail-transport';
import { ResendTransport } from './transports/resend.transport';
import { SmtpTransport } from './transports/smtp.transport';
import { PreviewTransport } from './transports/preview.transport';

export { addressOf, formatSender } from './outgoing-email';

export interface MailSendResult {
  sent: boolean;
  log_only?: boolean;
  preview?: boolean;
  messageId?: string | null;
}

/**
 * The last step of sending an email: delivery. The email arrives packaged,
 * with its sender already decided (SenderIdentityService) and its content
 * rendered (EmailChannel); this only hands it to the configured provider.
 *
 * Provider, in order of preference:
 *   1. Resend, when RESEND_API_KEY is set (can send from practices' verified domains).
 *   2. SMTP, when SMTP_HOST/USER/PASS (or MAIL_HOST/USER/PASS) are set.
 *   3. Preview: nothing is configured, so the email is logged instead.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: MailTransport;
  private readonly resendClient: ResendClient | null = null;

  constructor() {
    const env = process.env;
    const smtpHost = env.SMTP_HOST || env.MAIL_HOST || '';
    const smtpUser = env.SMTP_USER || env.MAIL_USER || '';
    const smtpPass = env.SMTP_PASS || env.MAIL_PASS || '';

    if (env.RESEND_API_KEY) {
      this.resendClient = new ResendClient(env.RESEND_API_KEY);
      this.transport = new ResendTransport(this.resendClient);
      this.logger.log('Email via Resend');
    } else if (smtpHost && smtpUser && smtpPass) {
      const port = Number(env.SMTP_PORT || env.MAIL_PORT || 465);
      this.transport = new SmtpTransport({ host: smtpHost, port, secure: env.SMTP_SECURE === 'true' || port === 465, user: smtpUser, pass: smtpPass });
      this.logger.log(`Email via SMTP ${smtpHost}:${port}`);
    } else {
      this.transport = new PreviewTransport();
      this.logger.warn('Neither RESEND_API_KEY nor SMTP_HOST/USER/PASS is set — emails run in PREVIEW mode and are logged to the console.');
    }
  }

  provider(): ProviderKey {
    return this.transport.key;
  }

  isConfigured(): boolean {
    return this.transport.key !== 'preview';
  }

  /** Whether the active provider can send from a practice's own verified domain. */
  canSignForDomains(): boolean {
    return this.transport.canSignForDomains;
  }

  /** The Resend client, for managing practices' sending domains. Null when Resend is not configured. */
  resend(): ResendClient | null {
    return this.resendClient;
  }

  async deliver(email: OutgoingEmail): Promise<MailSendResult> {
    if (process.env.EMAIL_LOG_ONLY === 'true') return { sent: false, log_only: true };
    const result = await this.transport.send(email);
    if (result.preview) return { sent: false, preview: true };
    return { sent: true, messageId: result.messageId };
  }
}
