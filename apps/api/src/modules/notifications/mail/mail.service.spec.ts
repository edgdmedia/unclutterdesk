import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService, addressOf, formatSender } from './mail.service';
import { ResendClient } from './resend.client';

const ENV_KEYS = ['RESEND_API_KEY', 'MAIL_FROM', 'SMTP_FROM', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_LOG_ONLY', 'SMTP_FROM_NAME'];

function prismaWith(domain: { domain: string; status: string; fromLocalPart: string } | null) {
  return { tenantSendingDomain: { findUnique: vi.fn().mockResolvedValue(domain) } } as any;
}

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

  it('previews when nothing is configured', async () => {
    const mail = new MailService(prismaWith(null));
    expect(mail.isConfigured()).toBe(false);
    await expect(mail.sendMail('c@x.ng', 'Hi', '<p>Hi</p>')).resolves.toEqual({ sent: false, preview: true });
  });

  describe('on Resend', () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = 're_test';
      process.env.MAIL_FROM = 'Unclutter Desk <notifications@mail.unclutterdesk.com>';
    });

    it('sends from a practice’s verified domain, with its name and reply-to', async () => {
      const send = vi.spyOn(ResendClient.prototype, 'sendEmail').mockResolvedValue({ id: 'em_1' });
      const mail = new MailService(prismaWith({ domain: 'unclutter.com.ng', status: 'VERIFIED', fromLocalPart: 'hello' }));

      const result = await mail.sendMail('c@x.ng', 'Booked', '<p>b</p>', 'b', {
        fromName: 'Unclutter Consult',
        replyTo: 'care@unclutter.com.ng',
        tenantId: 5n,
      });

      expect(result).toEqual({ sent: true, messageId: 'em_1' });
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"Unclutter Consult" <hello@unclutter.com.ng>',
          to: 'c@x.ng',
          replyTo: 'care@unclutter.com.ng',
        }),
      );
    });

    it.each(['PENDING', 'FAILED', 'TEMPORARY_FAILURE', 'NOT_STARTED'])(
      'falls back to the platform address when the domain is %s',
      async (status) => {
        const send = vi.spyOn(ResendClient.prototype, 'sendEmail').mockResolvedValue({ id: 'em_2' });
        const mail = new MailService(prismaWith({ domain: 'drjane.ng', status, fromLocalPart: 'notifications' }));
        await mail.sendMail('c@x.ng', 'Hi', '<p>Hi</p>', undefined, { fromName: 'Dr Jane', tenantId: 7n });
        expect(send.mock.calls[0][0].from).toBe('"Dr Jane" <notifications@mail.unclutterdesk.com>');
      },
    );

    it('uses the platform address for mail with no practice', async () => {
      const send = vi.spyOn(ResendClient.prototype, 'sendEmail').mockResolvedValue({ id: 'em_3' });
      const prisma = prismaWith(null);
      const mail = new MailService(prisma);
      await mail.sendMail('c@x.ng', 'Reset', '<p>r</p>');
      expect(send.mock.calls[0][0].from).toBe('"Unclutter Desk" <notifications@mail.unclutterdesk.com>');
      expect(prisma.tenantSendingDomain.findUnique).not.toHaveBeenCalled();
    });

    it('still sends from the platform address if the domain lookup fails', async () => {
      const send = vi.spyOn(ResendClient.prototype, 'sendEmail').mockResolvedValue({ id: 'em_4' });
      const prisma = { tenantSendingDomain: { findUnique: vi.fn().mockRejectedValue(new Error('db down')) } } as any;
      const mail = new MailService(prisma);
      await mail.sendMail('c@x.ng', 'Hi', '<p>Hi</p>', undefined, { tenantId: 7n });
      expect(send.mock.calls[0][0].from).toContain('notifications@mail.unclutterdesk.com');
    });
  });

  it('never uses a practice domain over SMTP, which cannot sign for it', async () => {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    process.env.SMTP_FROM = 'Unclutter Desk <no-reply@unclutterdesk.com>';
    const prisma = prismaWith({ domain: 'drjane.ng', status: 'VERIFIED', fromLocalPart: 'notifications' });
    const mail = new MailService(prisma);
    await expect(mail.senderAddressFor(7n)).resolves.toBe('no-reply@unclutterdesk.com');
    expect(prisma.tenantSendingDomain.findUnique).not.toHaveBeenCalled();
  });
});

describe('MailService sender precedence', () => {
  const keys = ['RESEND_API_KEY', 'MAIL_FROM', 'SMTP_FROM', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => keys.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; }));
  afterEach(() => keys.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))));

  it('keeps SMTP_FROM first on SMTP, so an existing deployment is unchanged', () => {
    Object.assign(process.env, { SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_FROM: 'a@old.ng', MAIL_FROM: 'b@new.ng' });
    expect(new MailService().platformSenderAddress()).toBe('a@old.ng');
  });

  it('reads MAIL_FROM first on Resend', () => {
    Object.assign(process.env, { RESEND_API_KEY: 're_x', SMTP_FROM: 'a@old.ng', MAIL_FROM: 'b@new.ng' });
    expect(new MailService().platformSenderAddress()).toBe('b@new.ng');
  });
});
