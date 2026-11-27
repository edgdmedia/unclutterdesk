import { describe, expect, it, vi } from 'vitest';
import { NotificationService } from './notification.service';
import { EmailChannel } from './channels/email.channel';
import { SenderIdentityService } from './mail/sender-identity.service';

describe('email brand', () => {
  it('gives emails a logo address, never an inline data URL', async () => {
    const prisma: any = { tenant: { findUnique: vi.fn().mockResolvedValue({ id: 7n, name: 'Calm', logoUrl: 'data:image/png;base64,QUJD', primaryColor: null, secondaryColor: null, publicEmail: null, publicPhone: null }) } };
    const service = new NotificationService(prisma, []);
    const brand = await service.resolveBrand(7n);
    expect(brand.logoUrl).toMatch(/\/v1\/tenant\/7\/logo\?v=/);
  });
});

// Account emails come from the platform for practice staff, but a client knows
// the practice, not the platform: their reset keeps the practice's name.
describe('who an account email is from', () => {
  async function resetFor(role: string) {
    vi.stubEnv('MAIL_FROM', 'Therapysts Desk <no-reply@notify.therapysts.com>');
    vi.stubEnv('MAIL_FROM_NAME', '');
    const prisma: any = {
      tenant: { findUnique: vi.fn().mockResolvedValue({ id: 7n, name: 'Calm Rooms', logoUrl: null, primaryColor: null, secondaryColor: null, publicEmail: 'hello@calm.ng', publicPhone: null }) },
      profile: { findUnique: vi.fn().mockResolvedValue({ role }) },
      tenantSendingDomain: { findUnique: vi.fn().mockResolvedValue(null) },
      emailLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const mail: any = { deliver: vi.fn().mockResolvedValue({ sent: true }), canSignForDomains: () => true };
    const service = new NotificationService(prisma, [new EmailChannel(mail, new SenderIdentityService(mail, prisma))]);
    await service.sendEmail({ to: 'p@x.ng', type: 'auth.password_reset', title: 'Reset your password', message: 'M', tenantId: 7n, profileId: 4n });
    vi.unstubAllEnvs();
    return mail.deliver.mock.calls[0][0];
  }

  it("a therapist's reset comes from the platform", async () => {
    const sent = await resetFor('THERAPIST');
    expect(sent.from.name).toBe('Therapysts Desk');
    expect(sent.replyTo).toBeUndefined();
  });

  it("a client's reset comes from their practice", async () => {
    const sent = await resetFor('CLIENT');
    expect(sent.from.name).toBe('Calm Rooms');
    expect(sent.replyTo).toBe('hello@calm.ng');
    expect(sent.html).toContain('Calm Rooms');
  });
});
