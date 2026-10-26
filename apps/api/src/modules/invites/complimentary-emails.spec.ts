import { describe, it, expect, vi } from 'vitest';
import { InviteService } from './invite.service';
import { complimentaryKey, complimentaryPrefix } from './complimentary-emails';

const DAY = 86_400_000;
const NOW = new Date('2026-11-01T12:00:00Z');

function make(tenants: Array<Record<string, unknown>>, owners = [{ id: 70n }]) {
  const prisma: any = {
    tenant: { findMany: vi.fn().mockResolvedValue(tenants), update: vi.fn() },
    profile: { findMany: vi.fn().mockResolvedValue(owners) },
  };
  const notifications: any = { queueReminder: vi.fn().mockResolvedValue(1n) };
  return { service: new InviteService(prisma, notifications), prisma, notifications };
}

const period = (reason: string, daysLeft: number) => ({
  id: 4n,
  subscriptionTier: 'STARTER',
  subscriptionStatus: null,
  complimentaryReason: reason,
  complimentaryUntil: new Date(NOW.getTime() + daysLeft * DAY),
});

describe('complimentary plan emails (§5.4)', () => {
  it('only look at running migration and invite-code periods (INTERNAL has no end date and gets none)', async () => {
    const { service, prisma } = make([]);
    await service.queueComplimentaryEmails(NOW);
    expect(prisma.tenant.findMany.mock.calls[0][0].where).toEqual({
      complimentaryUntil: { gt: NOW },
      complimentaryReason: { in: ['MIGRATION', 'INVITE_CODE'] },
    });
  });

  it('a migration period gets "free until", then reminders 14 and 3 days before, each keyed once', async () => {
    const t = period('MIGRATION', 90);
    const { service, notifications } = make([t]);
    await service.queueComplimentaryEmails(NOW);
    const [granted, r14, r3] = notifications.queueReminder.mock.calls;
    expect(granted[0].title).toMatch(/You have Starter free until \d+ January 2027/);
    expect(granted[0].triggerAt).toEqual(NOW);
    expect(r14[0].triggerAt).toEqual(new Date(t.complimentaryUntil.getTime() - 14 * DAY));
    expect(r3[0].triggerAt).toEqual(new Date(t.complimentaryUntil.getTime() - 3 * DAY));
    expect(r3[0].message).toContain('10 bookings a month');
    expect(r3[0].message).toContain('no bank transfer');
    expect([granted[1], r14[1], r3[1]]).toEqual([
      complimentaryKey(4n, t.complimentaryUntil, 'granted', 70n),
      complimentaryKey(4n, t.complimentaryUntil, 'reminder14', 70n),
      complimentaryKey(4n, t.complimentaryUntil, 'reminder3', 70n),
    ]);
    for (const [, key] of notifications.queueReminder.mock.calls) expect(key.startsWith(complimentaryPrefix(4n, t.complimentaryUntil))).toBe(true);
  });

  it('an invite-code period gets only the reminders', async () => {
    const { service, notifications } = make([period('INVITE_CODE', 30)]);
    await service.queueComplimentaryEmails(NOW);
    expect(notifications.queueReminder.mock.calls.map((c: any) => c[0].type)).toEqual([
      'billing.complimentary_reminder14',
      'billing.complimentary_reminder3',
    ]);
  });

  it('a period with less than 3 days left gets only the 3-day reminder, now', async () => {
    const { service, notifications } = make([period('INVITE_CODE', 2)]);
    await service.queueComplimentaryEmails(NOW);
    expect(notifications.queueReminder).toHaveBeenCalledTimes(1);
    expect(notifications.queueReminder.mock.calls[0][0].triggerAt).toEqual(NOW);
  });
});

describe('the expiry cron', () => {
  it('only ends periods with a past end date, so INTERNAL (no end date) never ends', async () => {
    const { service, prisma } = make([]);
    await service.expireComplimentary(NOW);
    expect(prisma.tenant.findMany.mock.calls[0][0].where).toEqual({ complimentaryUntil: { lte: NOW } });
  });
});
