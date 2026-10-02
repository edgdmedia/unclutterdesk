import { Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { SenderIdentityService } from '../mail/sender-identity.service';
import { absoluteUrl } from '../../../common/origins';
import {
  ChannelKey,
  ChannelRecipient,
  ChannelPayload,
  DeliveryResult,
  NotificationChannel,
} from './notification.channel';

/**
 * Everything in the message is text: practice names, admins' personal notes
 * and client names end up here, so none of it may be read as markup.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The email channel packages a notification as an email: the tenant-branded
 * content, and the sender from SenderIdentityService (the one place that
 * decides it). MailService then only delivers it, through whichever provider
 * is configured.
 */
@Injectable()
export class EmailChannel implements NotificationChannel {
  readonly key: ChannelKey = 'email';

  constructor(
    private readonly mail: MailService,
    private readonly identity: SenderIdentityService,
  ) {}

  isWired(): boolean {
    return true;
  }

  async send(recipient: ChannelRecipient, payload: ChannelPayload): Promise<DeliveryResult> {
    if (!recipient.email) return { success: false, error: 'Recipient has no email address' };

    const sender = await this.identity.senderFor({
      tenantId: recipient.tenantId,
      practiceName: payload.brand?.practiceName,
      replyTo: payload.brand?.publicEmail,
    });
    const result = await this.mail.deliver({
      to: recipient.email,
      subject: payload.title,
      html: this.render(payload),
      text: this.plainText(payload),
      from: { name: sender.name, address: sender.address },
      ...(sender.replyTo ? { replyTo: sender.replyTo } : {}),
    });

    if (result.sent) return { success: true, providerId: result.messageId ?? null };
    if (result.log_only) return { success: true, skipped: true, error: 'EMAIL_LOG_ONLY' };
    if (result.preview) return { success: true, providerId: 'preview' };
    return { success: false, error: 'Email not sent' };
  }

  /** The plain-text version: the message, then each detail and link on its own line. */
  private plainText(payload: ChannelPayload): string {
    const parts = [payload.message];
    if (payload.details?.length) parts.push(payload.details.map((d) => `${d.label}: ${d.value}`).join('\n'));
    if (payload.link) parts.push(`${payload.actionLabel || 'Open'}: ${absoluteUrl(payload.link)}`);
    if (payload.links?.length) parts.push(payload.links.map((l) => `${l.label}: ${absoluteUrl(l.url)}`).join('\n'));
    return parts.join('\n\n');
  }

  private render(payload: ChannelPayload): string {
    const brand = payload.brand;
    const primary = escapeHtml(brand?.primaryColor || '#0F3A53');
    const accent = escapeHtml(brand?.secondaryColor || '#E3B341');
    const name = escapeHtml(brand?.practiceName || 'Unclutter Desk');
    const logo = brand?.logoUrl
      ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${name}" style="height:36px;margin-bottom:16px;" />`
      : `<div style="font-size:18px;font-weight:700;margin-bottom:16px;">${name}</div>`;
    const code = payload.code
      ? `<div style="margin:22px 0 4px;padding:20px;border-radius:14px;background:#F8FAFC;text-align:center;">
          <div style="font-size:12px;letter-spacing:0.12em;color:#64748B;">${escapeHtml((payload.codeLabel || 'Verification code').toUpperCase())}</div>
          <div style="margin-top:8px;font-size:34px;font-weight:800;letter-spacing:0.16em;color:${primary};">${escapeHtml(payload.code)}</div>
        </div>`
      : '';
    const details = payload.details?.length
      ? `<table role="presentation" style="width:100%;margin-top:18px;border-collapse:collapse;border:1px solid #E2E8F0;border-radius:12px;">
          ${payload.details
            .map(
              (d) => `<tr><td style="padding:10px 14px;border-top:1px solid #F1F5F9;font-size:13px;color:#64748B;width:34%;vertical-align:top;">${escapeHtml(d.label)}</td><td style="padding:10px 14px;border-top:1px solid #F1F5F9;font-size:14px;font-weight:600;color:#0F172A;">${escapeHtml(d.value)}</td></tr>`,
            )
            .join('')}
        </table>`
      : '';
    const extraLinks = payload.links?.length
      ? `<div style="margin-top:18px;font-size:14px;line-height:1.9;">
          ${payload.links
            .map((l) => `<div><a href="${escapeHtml(absoluteUrl(l.url))}" style="color:${primary};font-weight:600;">${escapeHtml(l.label)}</a></div>`)
            .join('')}
        </div>`
      : '';
    const link = payload.link
      ? `<a href="${escapeHtml(absoluteUrl(payload.link))}" style="display:inline-block;margin-top:20px;padding:12px 28px;border-radius:10px;background:${primary};color:#FFFFFF;text-decoration:none;font-weight:700;">${escapeHtml(payload.actionLabel || 'View')}</a>`
      : '';
    const footer = [
      brand?.publicEmail ? brand.publicEmail : null,
      brand?.publicPhone ? brand.publicPhone : null,
      brand?.practiceName ? `${brand.practiceName}` : 'Unclutter Desk',
    ]
      .filter(Boolean)
      .map(escapeHtml)
      .join(' · ');

    return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="background:#FFFFFF;border-radius:20px;border:1px solid #E2E8F0;padding:28px;">
      ${logo}
      <div style="font-size:22px;font-weight:700;color:#0F172A;">${escapeHtml(payload.title)}</div>
      <div style="margin-top:12px;font-size:15px;line-height:1.7;color:#334155;white-space:pre-line;">${escapeHtml(payload.message)}</div>
      ${details}
      ${code}
      ${link}
      ${extraLinks}
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #E2E8F0;">
        <div style="width:44px;height:5px;border-radius:3px;background:${accent};"></div>
        <div style="margin-top:12px;font-size:11px;color:#94A3B8;">${footer}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }
}
