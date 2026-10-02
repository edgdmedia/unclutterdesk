import { formatSender, type OutgoingEmail } from '../outgoing-email';
import { ResendClient } from '../resend.client';
import type { MailTransport } from './mail-transport';

export class ResendTransport implements MailTransport {
  readonly key = 'resend' as const;
  readonly canSignForDomains = true;

  constructor(readonly client: ResendClient) {}

  async send(email: OutgoingEmail) {
    const result = await this.client.sendEmail({
      from: formatSender(email.from.name, email.from.address),
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: email.replyTo,
    });
    return { messageId: result.id ?? null };
  }
}
