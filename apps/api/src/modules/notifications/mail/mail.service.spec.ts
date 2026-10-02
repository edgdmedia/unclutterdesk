import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService } from './mail.service';
import { addressOf, formatSender, type OutgoingEmail } from './outgoing-email';
import { ResendClient } from './resend.client';

/**
 * MailService only delivers: the email arrives fully packaged, sender and all,
 * and goes out through whichever provider is configured. It decides nothing
 * about who the mail is from.
 */
const ENV_KEYS = ['RESEND_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_PORT', 'MAIL_HOST', 'MAIL_USER', 'MAIL_PASS', 'EMAIL_LOG_ONLY'];

const email: OutgoingEmail = {
  to: 'c@x.ng',
  subject: 'Your session is booked',
  html: '<p>Booked</p>',
  text: 'Booked',
  from: { name: 'Smith Therapy', address: 'notifications@notify.unclutterdesk.com' },
  replyTo: 'hello@smith.ng',
};

describe('formatSender / addressOf', () => {
  it('quotes the display name and escapes quotes in it', () => {
    expect(formatSender('Dr "Jane" Smith', 'a@b.ng')).toBe('"Dr \\"Jane\\" Smith" <a@b.ng>');
  });

  it('reads the address from either form', () => {
    expect(addressOf('Unclutter Desk <no-reply@unclutterdesk.com>')).toBe('no-reply@unclutterdesk.com');
    expect(addressOf(' hello@x.ng ')).toBe('hello@x.ng');
  });
});

describe('MailService', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.restoreAllMocks();
  });

  it('delivers through Resend exactly as packaged, when a Resend key is set', async () => {
    process.env.RESEND_API_KEY = 're_test';
    const send = vi.spyOn(ResendClient.prototype, 'sendEmail').mockResolvedValue({ id: 'em_1' });
    const mail = new MailService();
    expect(mail.provider()).toBe('resend');
    expect(mail.canSignForDomains()).toBe(true);
    await expect(mail.deliver(email)).resolves.toEqual({ sent: true, messageId: 'em_1' });
    expect(send).toHaveBeenCalledWith({
      from: '"Smith Therapy" <notifications@notify.unclutterdesk.com>',
      to: 'c@x.ng',
      subject: 'Your session is booked',
      html: '<p>Booked</p>',
      text: 'Booked',
      replyTo: 'hello@smith.ng',
    });
  });

  it('delivers through SMTP with the identical sender, when only SMTP is set', async () => {
    Object.assign(process.env, { SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'u', SMTP_PASS: 'p' });
    const mail = new MailService();
    expect(mail.provider()).toBe('smtp');
    expect(mail.canSignForDomains()).toBe(false);
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'm1' });
    (mail as any).transport.transporter = { sendMail };
    await expect(mail.deliver(email)).resolves.toEqual({ sent: true, messageId: 'm1' });
    expect(sendMail).toHaveBeenCalledWith({
      from: '"Smith Therapy" <notifications@notify.unclutterdesk.com>',
      to: 'c@x.ng',
      subject: 'Your session is booked',
      html: '<p>Booked</p>',
      text: 'Booked',
      replyTo: 'hello@smith.ng',
    });
  });

  it('prefers Resend when both are configured', () => {
    Object.assign(process.env, { RESEND_API_KEY: 're_test', SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'u', SMTP_PASS: 'p' });
    expect(new MailService().provider()).toBe('resend');
  });

  it('previews when nothing is configured, logging the packaged sender', async () => {
    const mail = new MailService();
    expect(mail.provider()).toBe('preview');
    expect(mail.isConfigured()).toBe(false);
    const log = vi.spyOn((mail as any).transport.logger, 'log').mockImplementation(() => undefined);
    await expect(mail.deliver(email)).resolves.toEqual({ sent: false, preview: true });
    expect(log.mock.calls[0][0]).toContain('From: "Smith Therapy" <notifications@notify.unclutterdesk.com>');
  });

  it('sends nothing in log-only mode', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_LOG_ONLY = 'true';
    const send = vi.spyOn(ResendClient.prototype, 'sendEmail');
    await expect(new MailService().deliver(email)).resolves.toEqual({ sent: false, log_only: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('lets a provider failure reach the caller, so it is recorded', async () => {
    process.env.RESEND_API_KEY = 're_test';
    vi.spyOn(ResendClient.prototype, 'sendEmail').mockRejectedValue(new Error('domain not verified'));
    await expect(new MailService().deliver(email)).rejects.toThrow('domain not verified');
  });
});
