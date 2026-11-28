import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SenderIdentityService } from './sender-identity.service';

/**
 * The one place that decides who an email is from. Whatever delivers it
 * (Resend, SMTP, or a provider added later), the name and address follow the
 * same rules: the practice's name for practice mail, Therapysts otherwise;
 * the practice's own verified domain only when the provider can sign for it.
 */
const ENV_KEYS = ['MAIL_FROM', 'SMTP_FROM', 'MAIL_FROM_NAME', 'SMTP_FROM_NAME'];

function make({ canSignForDomains = true, domain = null as null | { domain: string; status: string; fromLocalPart: string }, lookupFails = false } = {}) {
  const prisma: any = {
    tenantSendingDomain: {
      findUnique: lookupFails ? vi.fn().mockRejectedValue(new Error('db down')) : vi.fn().mockResolvedValue(domain),
    },
  };
  const mail: any = { canSignForDomains: () => canSignForDomains };
  return { identity: new SenderIdentityService(mail, prisma), prisma };
}

describe('SenderIdentityService', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    process.env.MAIL_FROM = 'Therapysts <notifications@notify.therapysts.app>';
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('sends platform mail as Therapysts from the platform address', async () => {
    const { identity, prisma } = make();
    await expect(identity.senderFor({})).resolves.toEqual({
      name: 'Therapysts',
      address: 'notifications@notify.therapysts.app',
      replyTo: undefined,
    });
    expect(prisma.tenantSendingDomain.findUnique).not.toHaveBeenCalled();
  });

  it("sends practice mail in the practice's name, replying to the practice", async () => {
    const { identity } = make();
    await expect(identity.senderFor({ tenantId: 7n, practiceName: 'Smith Therapy', replyTo: 'hello@smith.ng' })).resolves.toEqual({
      name: 'Smith Therapy',
      address: 'notifications@notify.therapysts.app',
      replyTo: 'hello@smith.ng',
    });
  });

  it('gives the same sender whichever provider delivers it, when the practice has no verified domain', async () => {
    const viaResend = await make({ canSignForDomains: true }).identity.senderFor({ tenantId: 7n, practiceName: 'Smith Therapy' });
    const viaSmtp = await make({ canSignForDomains: false }).identity.senderFor({ tenantId: 7n, practiceName: 'Smith Therapy' });
    expect(viaSmtp).toEqual(viaResend);
  });

  it("uses the practice's verified domain when the provider can sign for it", async () => {
    const { identity } = make({ domain: { domain: 'smith.ng', status: 'VERIFIED', fromLocalPart: 'hello' } });
    expect((await identity.senderFor({ tenantId: 7n, practiceName: 'Smith Therapy' })).address).toBe('hello@smith.ng');
  });

  it("never uses a practice domain through a provider that can't sign for it", async () => {
    const { identity, prisma } = make({ canSignForDomains: false, domain: { domain: 'smith.ng', status: 'VERIFIED', fromLocalPart: 'hello' } });
    expect((await identity.senderFor({ tenantId: 7n })).address).toBe('notifications@notify.therapysts.app');
    expect(prisma.tenantSendingDomain.findUnique).not.toHaveBeenCalled();
  });

  it.each(['PENDING', 'FAILED', 'NOT_STARTED'])('uses the platform address while the domain is %s', async (status) => {
    const { identity } = make({ domain: { domain: 'smith.ng', status, fromLocalPart: 'hello' } });
    expect((await identity.senderFor({ tenantId: 7n })).address).toBe('notifications@notify.therapysts.app');
  });

  it('still sends from the platform address if the domain lookup fails', async () => {
    const { identity } = make({ lookupFails: true });
    expect((await identity.senderFor({ tenantId: 7n })).address).toBe('notifications@notify.therapysts.app');
  });

  it('a practice with no name yet is sent as Therapysts', async () => {
    const { identity } = make();
    expect((await identity.senderFor({ tenantId: 7n, practiceName: '   ' })).name).toBe('Therapysts');
  });

  describe('the platform sender', () => {
    it('reads MAIL_FROM first, then SMTP_FROM', () => {
      process.env.SMTP_FROM = 'no-reply@therapysts.app';
      expect(make().identity.platformAddress()).toBe('notifications@notify.therapysts.app');
      delete process.env.MAIL_FROM;
      expect(make().identity.platformAddress()).toBe('no-reply@therapysts.app');
    });

    it('falls back to no-reply@therapysts.app when nothing is set', () => {
      delete process.env.MAIL_FROM;
      expect(make().identity.platformAddress()).toBe('no-reply@therapysts.app');
    });

    it('names the platform from MAIL_FROM_NAME, then the name in MAIL_FROM, then Therapysts', () => {
      process.env.MAIL_FROM = 'Therapysts Team <notifications@notify.therapysts.app>';
      expect(make().identity.platformName()).toBe('Therapysts Team');
      process.env.MAIL_FROM_NAME = 'Unclutter';
      expect(make().identity.platformName()).toBe('Unclutter');
      delete process.env.MAIL_FROM_NAME;
      process.env.MAIL_FROM = 'notifications@notify.therapysts.app';
      expect(make().identity.platformName()).toBe('Therapysts');
    });
  });
});
