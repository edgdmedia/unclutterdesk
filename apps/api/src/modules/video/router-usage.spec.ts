import { describe, it, expect, vi } from 'vitest';
import { VideoRouter } from './video-router.service';
import { VideoUsageService, monthStart } from './video-usage.service';

const provider = (key: string, available = true) => ({ key, available: () => available }) as any;

function router({ dailyMin = 0, jaasUsers = 0, dailyOk = true, jaasOk = true } = {}) {
  const usage: any = { dailyMinutesThisMonth: vi.fn().mockResolvedValue(dailyMin), jaasUsersThisMonth: vi.fn().mockResolvedValue(jaasUsers) };
  return new VideoRouter(usage, [provider('DAILY', dailyOk), provider('JAAS', jaasOk), provider('LINK')]);
}

describe('choosing a provider for a new room', () => {
  it('uses Daily while under its monthly minutes', async () => {
    expect((await router({ dailyMin: 9499 }).choose()).key).toBe('DAILY');
  });
  it('moves to JaaS once Daily reaches the limit', async () => {
    expect((await router({ dailyMin: 9500 }).choose()).key).toBe('JAAS');
  });
  it('moves to a link once JaaS reaches its users', async () => {
    expect((await router({ dailyMin: 9500, jaasUsers: 23 }).choose()).key).toBe('LINK');
  });
  it('skips a provider without keys', async () => {
    expect((await router({ dailyOk: false }).choose()).key).toBe('JAAS');
  });
  it('reads the limits from the environment', async () => {
    process.env.VIDEO_DAILY_MONTHLY_MINUTES = '100';
    expect((await router({ dailyMin: 100 }).choose()).key).toBe('JAAS');
    delete process.env.VIDEO_DAILY_MONTHLY_MINUTES;
  });
});

describe('usage', () => {
  it('starts the month at midnight WAT', () => {
    expect(monthStart(new Date('2026-10-31T23:30:00Z')).toISOString()).toBe('2026-10-31T23:00:00.000Z');
    expect(monthStart(new Date('2026-10-15T12:00:00Z')).toISOString()).toBe('2026-09-30T23:00:00.000Z');
  });

  it('counts minutes up to the last heartbeat, only on the caller\'s own row', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-06T10:12:30Z'));
    const prisma: any = { videoParticipant: { findFirst: vi.fn().mockResolvedValue({ id: 1n, joinedAt: new Date('2026-10-06T10:00:00Z') }), updateMany: vi.fn() } };
    await new VideoUsageService(prisma).heartbeat(1n, 5n);
    expect(prisma.videoParticipant.findFirst.mock.calls[0][0].where).toMatchObject({ id: 1n, profileId: 5n, reconciled: false });
    expect(prisma.videoParticipant.updateMany.mock.calls[0][0].data).toMatchObject({ minutes: 13 });
    vi.useRealTimers();
  });

  it('sums Daily minutes since the start of the month', async () => {
    const prisma: any = { videoParticipant: { aggregate: vi.fn().mockResolvedValue({ _sum: { minutes: 420 } }) } };
    expect(await new VideoUsageService(prisma).dailyMinutesThisMonth(new Date('2026-10-15T12:00:00Z'))).toBe(420);
    expect(prisma.videoParticipant.aggregate.mock.calls[0][0].where).toMatchObject({ provider: 'DAILY', joinedAt: { gte: new Date('2026-09-30T23:00:00Z') } });
  });

  it('reports a month by provider and by practice', async () => {
    const prisma: any = {
      videoParticipant: {
        groupBy: vi.fn()
          .mockResolvedValueOnce([
            { provider: 'DAILY', _sum: { minutes: 300 }, _count: { profileId: 6 } },
            { provider: 'JAAS', _sum: { minutes: 50 }, _count: { profileId: 2 } },
          ])
          .mockResolvedValueOnce([
            { tenantId: 1n, provider: 'DAILY', _sum: { minutes: 300 } },
            { tenantId: 2n, provider: 'JAAS', _sum: { minutes: 50 } },
          ]),
        findMany: vi.fn().mockResolvedValue([
          { tenantId: 1n, provider: 'DAILY', bookingId: 10n },
          { tenantId: 1n, provider: 'DAILY', bookingId: 11n },
          { tenantId: 2n, provider: 'JAAS', bookingId: 20n },
        ]),
      },
      tenant: { findMany: vi.fn().mockResolvedValue([{ id: 1n, name: 'Calm Harbor' }, { id: 2n, name: 'Dr Smith' }]) },
    };
    const r = await new VideoUsageService(prisma).report('2026-10');
    expect(prisma.videoParticipant.groupBy.mock.calls[0][0].where.joinedAt).toEqual({ gte: new Date('2026-09-30T23:00:00Z'), lt: new Date('2026-10-31T23:00:00Z') });
    expect(r.month).toBe('2026-10');
    expect(r.limits).toEqual({ dailyMinutes: 9500, jaasUsers: 23 });
    expect(r.totals).toEqual([
      { provider: 'DAILY', minutes: 300, participants: 6 },
      { provider: 'JAAS', minutes: 50, participants: 2 },
    ]);
    expect(r.practices).toEqual([
      { tenantId: '1', name: 'Calm Harbor', provider: 'DAILY', minutes: 300, sessions: 2 },
      { tenantId: '2', name: 'Dr Smith', provider: 'JAAS', minutes: 50, sessions: 1 },
    ]);
  });

  it('refuses a malformed month', async () => {
    await expect(new VideoUsageService({} as any).report('2026-13')).rejects.toThrow();
  });
});
