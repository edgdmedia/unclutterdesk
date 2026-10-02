import { Logger } from '@nestjs/common';
import { formatSender, type OutgoingEmail } from '../outgoing-email';
import type { MailTransport } from './mail-transport';

/** Nothing configured: the email is logged, sender and all, instead of sent. */
export class PreviewTransport implements MailTransport {
  readonly key = 'preview' as const;
  readonly canSignForDomains = false;
  readonly logger = new Logger('MailPreview');

  async send(email: OutgoingEmail) {
    const body = email.text || email.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    this.logger.log(
      `[MAIL-PREVIEW] From: ${formatSender(email.from.name, email.from.address)}${email.replyTo ? ` | Reply-To: ${email.replyTo}` : ''}\nTo: ${email.to}\nSubject: ${email.subject}\n${body}`,
    );
    return { messageId: 'preview', preview: true };
  }
}
