import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Google SMTP (smtp.gmail.com:465 + app password). SMTP_* names match the
// Unclutter suite; MAIL_* is kept as a fallback for existing deployments.
const SMTP_HOST = process.env.SMTP_HOST || process.env.MAIL_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 465);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER || process.env.MAIL_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || process.env.MAIL_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || process.env.MAIL_FROM || 'Unclutter Desk <no-reply@unclutterdesk.com>';

export interface MailSendResult {
  sent: boolean;
  log_only?: boolean;
  preview?: boolean;
  messageId?: string | null;
}

export interface SendMailOptions {
  /** Display name of the sender; defaults to SMTP_FROM_NAME / "Unclutter Desk". */
  fromName?: string;
  /** Reply-To address (e.g. the practice's public email). Defaults to the sender. */
  replyTo?: string;
}

/**
 * Low-level SMTP transport used by the email notification channel. This is the
 * only place that talks to nodemailer — all rendering and dispatch happens in
 * the notifications hub (NotificationService / EmailChannel), so auth and other
 * modules never import this directly.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;

  constructor() {
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
      this.logger.log(`SMTP configured via ${SMTP_HOST}:${SMTP_PORT}`);
    } else {
      this.transporter = null;
      this.logger.warn(
        'SMTP_HOST / SMTP_USER / SMTP_PASS are not set — emails run in PREVIEW mode and are logged to the console.',
      );
    }
  }

  isConfigured(): boolean {
    return !!this.transporter;
  }

  private buildSender(fromName?: string): string {
    const raw = SMTP_FROM.trim();
    const name = (fromName || process.env.SMTP_FROM_NAME || 'Unclutter Desk').trim().replace(/"/g, '\\"');
    if (raw.includes('<') && raw.includes('>')) {
      const addr = raw.match(/<([^>]+)>/)?.[1] ?? raw;
      return `"${name}" <${addr}>`;
    }
    return `"${name}" <${raw}>`;
  }

  async sendMail(
    to: string,
    subject: string,
    html: string,
    text?: string,
    options: SendMailOptions = {},
  ): Promise<MailSendResult> {
    if (process.env.EMAIL_LOG_ONLY === 'true') {
      return { sent: false, log_only: true };
    }

    if (!this.transporter) {
      const fromLabel = options.fromName || 'Unclutter Desk';
      this.logger.log(`[MAIL-PREVIEW] From: "${fromLabel}"${options.replyTo ? ` | Reply-To: ${options.replyTo}` : ''}\nTo: ${to}\nSubject: ${subject}\n${text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`);
      return { sent: false, preview: true };
    }

    const result = await this.transporter.sendMail({
      from: this.buildSender(options.fromName),
      to,
      subject,
      html,
      ...(text ? { text } : {}),
      ...(options.replyTo ? { replyTo: options.replyTo } : {}),
    });
    return { sent: true, messageId: result.messageId ?? null };
  }
}
