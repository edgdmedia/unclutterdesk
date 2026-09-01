import { Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import {
  ChannelKey,
  ChannelRecipient,
  ChannelPayload,
  DeliveryResult,
  NotificationChannel,
} from './notification.channel';

/**
 * Email delivery channel. Wired when SMTP credentials exist (Google SMTP via
 * MailService) OR when the app is running in dev/preview mode (emails are then
 * logged instead of sent — see MailService). Renders a tenant-branded HTML
 * message so tenants can plug their own look-and-feel in.
 */
@Injectable()
export class EmailChannel implements NotificationChannel {
  readonly key: ChannelKey = 'email';

  constructor(private readonly mail: MailService) {}

  isWired(): boolean {
    return true;
  }

  async send(recipient: ChannelRecipient, payload: ChannelPayload): Promise<DeliveryResult> {
    if (!recipient.email) return { success: false, error: 'Recipient has no email address' };

    const text = payload.message;
    const html = this.render(payload);
    const result = await this.mail.sendMail(recipient.email, payload.title, html, text, {
      fromName: payload.brand?.practiceName || undefined,
      replyTo: payload.brand?.publicEmail || undefined,
    });

    if (result.sent) return { success: true, providerId: result.messageId ?? null };
    if (result.log_only) return { success: true, skipped: true, error: 'EMAIL_LOG_ONLY' };
    if (result.preview) return { success: true, providerId: 'preview' };
    return { success: false, error: 'Email not sent' };
  }

  private render(payload: ChannelPayload): string {
    const brand = payload.brand;
    const primary = brand?.primaryColor || '#0F3A53';
    const accent = brand?.secondaryColor || '#E3B341';
    const logo = brand?.logoUrl
      ? `<img src="${brand.logoUrl}" alt="${brand.practiceName}" style="height:36px;margin-bottom:16px;" />`
      : `<div style="font-size:18px;font-weight:700;">${brand?.practiceName || 'Unclutter Desk'}</div>`;
    const code = payload.code
      ? `<div style="margin:22px 0 4px;padding:20px;border-radius:14px;background:#F8FAFC;text-align:center;">
          <div style="font-size:12px;letter-spacing:0.12em;color:#64748B;">VERIFICATION CODE</div>
          <div style="margin-top:8px;font-size:34px;font-weight:800;letter-spacing:0.16em;color:${primary};">${payload.code}</div>
        </div>`
      : '';
    const link = payload.link
      ? `<a href="${payload.link}" style="display:inline-block;margin-top:20px;padding:12px 28px;border-radius:10px;background:${primary};color:#FFFFFF;text-decoration:none;font-weight:700;">${payload.actionLabel || 'View'}</a>`
      : '';
    const footer = [
      brand?.publicEmail ? brand.publicEmail : null,
      brand?.publicPhone ? brand.publicPhone : null,
      brand?.practiceName ? `${brand.practiceName}` : 'Unclutter Desk',
    ]
      .filter(Boolean)
      .join(' · ');

    return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="background:#FFFFFF;border-radius:20px;border:1px solid #E2E8F0;padding:28px;">
      ${logo}
      <div style="font-size:22px;font-weight:700;color:#0F172A;">${payload.title}</div>
      <div style="margin-top:12px;font-size:15px;line-height:1.7;color:#334155;white-space:pre-line;">${payload.message}</div>
      ${code}
      ${link}
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
