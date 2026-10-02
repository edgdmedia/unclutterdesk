import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { formatSender, type OutgoingEmail } from '../outgoing-email';
import type { MailTransport } from './mail-transport';

/** Plain SMTP (Google Workspace today). It can't sign for a practice's domain. */
export class SmtpTransport implements MailTransport {
  readonly key = 'smtp' as const;
  readonly canSignForDomains = false;
  transporter: Pick<Transporter, 'sendMail'>;

  constructor(opts: { host: string; port: number; secure: boolean; user: string; pass: string }) {
    this.transporter = nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      secure: opts.secure,
      auth: { user: opts.user, pass: opts.pass },
    });
  }

  async send(email: OutgoingEmail) {
    const result = await this.transporter.sendMail({
      from: formatSender(email.from.name, email.from.address),
      to: email.to,
      subject: email.subject,
      html: email.html,
      ...(email.text ? { text: email.text } : {}),
      ...(email.replyTo ? { replyTo: email.replyTo } : {}),
    });
    return { messageId: result.messageId ?? null };
  }
}
