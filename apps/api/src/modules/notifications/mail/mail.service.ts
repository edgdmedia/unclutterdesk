import { Injectable, Logger, Optional } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ResendClient } from './resend.client';

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
  /**
   * The practice this mail is for. When it has a verified sending domain the
   * mail goes out from that domain; otherwise from the platform's address.
   */
  tenantId?: bigint | null;
}

/** "Name" <address>, with quotes in the name escaped. */
export function formatSender(name: string, address: string): string {
  return `"${name.trim().replace(/[\\"]/g, '\\$&')}" <${address}>`;
}

/** The address part of "Name <a@b>" or a bare "a@b". */
export function addressOf(value: string): string {
  const raw = value.trim();
  return raw.match(/<([^>]+)>/)?.[1]?.trim() ?? raw;
}

type Transport = 'resend' | 'smtp' | 'preview';

/**
 * The one place that sends email. All rendering and dispatch happens in the
 * notifications hub (NotificationService / EmailChannel), so auth and other
 * modules never import this directly.
 *
 * Transport, in order of preference:
 *   1. Resend, when RESEND_API_KEY is set. Practices with a verified sending
 *      domain send from it; everyone else from MAIL_FROM.
 *   2. SMTP (SMTP_HOST/USER/PASS), the original Google SMTP setup. Always
 *      sends from the platform address, since SMTP cannot sign for a
 *      practice's domain.
 *   3. Preview: nothing is configured, so mail is logged instead.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transport;
  private readonly resendClient: ResendClient | null = null;
  private readonly smtp: Transporter | null = null;
  private readonly defaultFrom: string;

  constructor(@Optional() private readonly prisma?: PrismaService) {
    const env = process.env;
    const fallbackFrom = 'Unclutter Desk <no-reply@unclutterdesk.com>';
    // Resend reads MAIL_FROM first; SMTP keeps its original precedence
    // (SMTP_FROM, then MAIL_FROM) so an existing deployment's sender is unchanged.
    this.defaultFrom = addressOf(
      env.RESEND_API_KEY
        ? env.MAIL_FROM || env.SMTP_FROM || fallbackFrom
        : env.SMTP_FROM || env.MAIL_FROM || fallbackFrom,
    );

    const smtpHost = env.SMTP_HOST || env.MAIL_HOST || '';
    const smtpUser = env.SMTP_USER || env.MAIL_USER || '';
    const smtpPass = env.SMTP_PASS || env.MAIL_PASS || '';

    if (env.RESEND_API_KEY) {
      this.resendClient = new ResendClient(env.RESEND_API_KEY);
      this.transport = 'resend';
      this.logger.log(`Email via Resend, default sender ${this.defaultFrom}`);
    } else if (smtpHost && smtpUser && smtpPass) {
      const port = Number(env.SMTP_PORT || env.MAIL_PORT || 465);
      this.smtp = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure: env.SMTP_SECURE === 'true' || port === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      this.transport = 'smtp';
      this.logger.log(`Email via SMTP ${smtpHost}:${port}`);
    } else {
      this.transport = 'preview';
      this.logger.warn(
        'Neither RESEND_API_KEY nor SMTP_HOST/USER/PASS is set — emails run in PREVIEW mode and are logged to the console.',
      );
    }
  }

  isConfigured(): boolean {
    return this.transport !== 'preview';
  }

  /** The Resend client, for managing practices' sending domains. Null when Resend is not configured. */
  resend(): ResendClient | null {
    return this.resendClient;
  }

  /** The platform's own sender address, used whenever a practice has no verified domain. */
  platformSenderAddress(): string {
    return this.defaultFrom;
  }

  /**
   * The address this practice's mail goes out from right now. Only a
   * VERIFIED domain counts, and only on Resend, which signs for it.
   */
  async senderAddressFor(tenantId: bigint | null | undefined): Promise<string> {
    if (tenantId == null || this.transport !== 'resend' || !this.prisma) return this.defaultFrom;
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
    return this.defaultFrom;
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

    const fromName = options.fromName || process.env.SMTP_FROM_NAME || 'Unclutter Desk';

    if (this.transport === 'preview') {
      this.logger.log(
        `[MAIL-PREVIEW] From: "${fromName}"${options.replyTo ? ` | Reply-To: ${options.replyTo}` : ''}\nTo: ${to}\nSubject: ${subject}\n${text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`,
      );
      return { sent: false, preview: true };
    }

    if (this.transport === 'resend' && this.resendClient) {
      const address = await this.senderAddressFor(options.tenantId);
      const result = await this.resendClient.sendEmail({
        from: formatSender(fromName, address),
        to,
        subject,
        html,
        text,
        replyTo: options.replyTo,
      });
      return { sent: true, messageId: result.id ?? null };
    }

    const result = await this.smtp!.sendMail({
      from: formatSender(fromName, this.defaultFrom),
      to,
      subject,
      html,
      ...(text ? { text } : {}),
      ...(options.replyTo ? { replyTo: options.replyTo } : {}),
    });
    return { sent: true, messageId: result.messageId ?? null };
  }
}
