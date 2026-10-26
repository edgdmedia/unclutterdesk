import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SubscriptionLapseService, lapsePrefix } from './subscription-lapse.service';

const DAY = 86_400_000;
const T = 7n;

function makeLapse(tenant: Record<string, unknown> | null = {}) {
  const prisma: any = {
    tenant: {
      findUnique: vi.fn().mockResolvedValue(
        tenant && {
          id: T,
          subscriptionLapsedAt: null,
          downgradeAt: null,
          subscriptionTier: 'PRO',
          subscriptionStatus: 'past_due',
          complimentaryUntil: null,
          complimentaryReason: null,
          ...tenant,
        },
      ),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    profile: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    consultBooking: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn().mockImplementation(async (ops: unknown[]) => Promise.all(ops)),
  };
  const notifications: any = {
    queueReminder: vi.fn().mockResolvedValue(1n),
    cancelRemindersWithPrefix: vi.fn().mockResolvedValue(3),
    notify: vi.fn().mockResolvedValue([]),
  };
  return { service: new SubscriptionLapseService(prisma, notifications), prisma, notifications };
}

describe('the lapse timeline (§5.4a)', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  describe('starting', () => {
    it('sets day 0 and the move-to-Free date (grace 7 + notice 14 = day 21) without touching the plan', async () => {
      const { service, prisma } = makeLapse();
      const day0 = new Date('2026-11-01T09:00:00Z');
      expect(await service.startLapse(T, day0)).toBe(true);
      expect(prisma.tenant.updateMany).toHaveBeenCalledWith({
        where: { id: T, subscriptionLapsedAt: null },
        data: { subscriptionLapsedAt: day0, downgradeAt: new Date(day0.getTime() + 21 * DAY) },
      });
      for (const [args] of prisma.tenant.updateMany.mock.calls) expect(args.data).not.toHaveProperty('subscriptionTier');
    });

    it('honours configured grace and notice periods', async () => {
      process.env.BILLING_GRACE_DAYS = '3';
      process.env.BILLING_NOTICE_DAYS = '10';
      const { service, prisma } = makeLapse();
      const day0 = new Date('2026-11-01T09:00:00Z');
      await service.startLapse(T, day0);
      expect(prisma.tenant.updateMany.mock.calls[0][0].data.downgradeAt).toEqual(new Date(day0.getTime() + 13 * DAY));
    });

    it('queues the owner emails once each, with the exact date in the notice, under one prefix', async () => {
      const { service, prisma, notifications } = makeLapse();
      prisma.profile.findMany.mockResolvedValue([{ id: 70n }]);
      const day0 = new Date('2026-11-01T09:00:00Z');
      await service.startLapse(T, day0);
      const calls = notifications.queueReminder.mock.calls;
      expect(calls.map((c: any) => c[1])).toEqual([
        `${lapsePrefix(T, day0)}start:70`,
        `${lapsePrefix(T, day0)}grace:70`,
        `${lapsePrefix(T, day0)}notice:70`,
      ]);
      const notice = calls[2][0];
      expect(notice.triggerAt).toEqual(new Date(day0.getTime() + 7 * DAY));
      expect(notice.title).toContain('22 November 2026');
    });

    it.each([
      ['already lapsing', { subscriptionLapsedAt: new Date() }],
      ['on FREE', { subscriptionTier: 'FREE' }],
      ['INTERNAL with no end date', { complimentaryReason: 'INTERNAL', subscriptionStatus: null }],
      ['on a complimentary period', { complimentaryUntil: new Date(Date.now() + 30 * DAY), complimentaryReason: 'INVITE_CODE' }],
    ])('does nothing when the practice is %s', async (_label, over) => {
      const { service, prisma } = makeLapse(over);
      expect(await service.startLapse(T, new Date())).toBe(false);
      expect(prisma.tenant.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('paying again', () => {
    it('cancels the queued emails, clears the dates and reactivates only downgrade-paused memberships', async () => {
      const day0 = new Date('2026-11-01T09:00:00Z');
      const { service, prisma, notifications } = makeLapse({ subscriptionLapsedAt: day0 });
      prisma.profile.findMany.mockResolvedValue([{ id: 81n }, { id: 82n }]);
      await service.stopLapse(T);
      expect(notifications.cancelRemindersWithPrefix).toHaveBeenCalledWith(lapsePrefix(T, day0));
      expect(prisma.tenant.update).toHaveBeenCalledWith({ where: { id: T }, data: { subscriptionLapsedAt: null, downgradeAt: null } });
      expect(prisma.profile.findMany.mock.calls[0][0].where).toEqual({ tenantId: T, pausedByDowngradeAt: { not: null } });
      expect(prisma.profile.updateMany).toHaveBeenCalledWith({
        where: { tenantId: T, pausedByDowngradeAt: { not: null } },
        data: { status: 'active', pausedByDowngradeAt: null },
      });
      expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'billing.membership_reactivated', profileIds: [81n, 82n] }));
    });
  });

  describe('the daily job', () => {
    it('never touches INTERNAL practices, in either query', async () => {
      const { service, prisma } = makeLapse();
      await service.enforce(new Date('2026-11-30T03:00:00Z'));
      for (const [args] of prisma.tenant.findMany.mock.calls) {
        expect(JSON.stringify(args.where)).toContain('"complimentaryReason":{"not":"INTERNAL"}');
      }
      expect(prisma.tenant.findMany).toHaveBeenCalledTimes(2);
    });

    it('starts a cancelled practice at its period end and an unpaid renewal now', async () => {
      const { service, prisma } = makeLapse();
      const now = new Date('2026-11-30T03:00:00Z');
      const periodEnd = new Date('2026-11-28T00:00:00Z');
      prisma.tenant.findMany
        .mockResolvedValueOnce([
          { id: 1n, subscriptionStatus: 'cancelled', subscriptionRenewsAt: periodEnd },
          { id: 2n, subscriptionStatus: 'past_due', subscriptionRenewsAt: null },
        ])
        .mockResolvedValueOnce([]);
      const start = vi.spyOn(service, 'startLapse').mockResolvedValue(true);
      await service.enforce(now);
      expect(start).toHaveBeenCalledWith(1n, periodEnd);
      expect(start).toHaveBeenCalledWith(2n, now);
    });
  });

  describe('moving to Free on day 21', () => {
    let lapse: ReturnType<typeof makeLapse>;
    const now = new Date('2026-11-22T03:00:00Z');

    beforeEach(() => {
      lapse = makeLapse({ subscriptionLapsedAt: new Date('2026-11-01'), downgradeAt: new Date('2026-11-22T00:00:00Z'), subscriptionStatus: 'cancelled' });
    });

    it('drops the plan, clears the dates and pauses every active non-owner membership', async () => {
      const { service, prisma } = lapse;
      prisma.profile.findMany.mockImplementation(async (args: any) =>
        args.where.role?.in ? [{ id: 81n }, { id: 82n }] : [{ id: 70n }],
      );
      expect(await service.moveToFree(T, now)).toBe(true);
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: T },
        data: { subscriptionTier: 'FREE', subscriptionLapsedAt: null, downgradeAt: null },
      });
      const pauseQuery = prisma.profile.findMany.mock.calls.find((c: any) => c[0].where.role?.in)[0];
      expect(pauseQuery.where).toEqual({ tenantId: T, status: 'active', role: { in: ['ADMIN', 'RECEPTIONIST', 'THERAPIST'] } });
      expect(prisma.profile.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [81n, 82n] } },
        data: { status: 'inactive', pausedByDowngradeAt: now },
      });
    });

    it('keeps upcoming sessions with paused therapists, and emails the owner the list', async () => {
      const { service, prisma, notifications } = lapse;
      prisma.profile.findMany.mockImplementation(async (args: any) => (args.where.role?.in ? [{ id: 81n }] : [{ id: 70n }]));
      prisma.consultBooking.findMany.mockResolvedValue([
        {
          id: 500n,
          client: { firstName: 'Ada', lastName: 'Obi', email: 'ada@x.ng' },
          availability: { startsAt: new Date('2026-11-25T10:00:00Z'), therapist: { profile: { firstName: 'Nkem', lastName: 'Eze' } } },
        },
      ]);
      await service.moveToFree(T, now);
      expect(prisma.consultBooking.findMany.mock.calls[0][0].where.status).toEqual({ not: 'CANCELLED' });
      const ownerEmail = notifications.notify.mock.calls.find((c: any) => c[0].type === 'billing.downgraded')[0];
      expect(ownerEmail.profileIds).toEqual([70n]);
      expect(ownerEmail.message).toContain('Ada Obi with Nkem Eze on 25 November 2026');
      expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'billing.membership_paused', profileIds: [81n] }));
    });

    it('does nothing before the date', async () => {
      const { service, prisma } = lapse;
      expect(await service.moveToFree(T, new Date('2026-11-21T23:00:00Z'))).toBe(false);
      expect(prisma.tenant.update).not.toHaveBeenCalled();
    });
  });

  describe("the owner's view", () => {
    it('shows the dates, and the sessions only once the notice period has begun', async () => {
      const { service, prisma } = makeLapse({ subscriptionLapsedAt: new Date('2026-11-01T00:00:00Z'), downgradeAt: new Date('2026-11-22T00:00:00Z') });
      const grace = await service.status(T, new Date('2026-11-05T00:00:00Z'));
      expect(grace).toMatchObject({ lapsing: true, inNotice: false, noticeFrom: '2026-11-08T00:00:00.000Z', sessions: [] });
      expect(prisma.consultBooking.findMany).not.toHaveBeenCalled();
      const notice = await service.status(T, new Date('2026-11-10T00:00:00Z'));
      expect(notice).toMatchObject({ inNotice: true, downgradeAt: '2026-11-22T00:00:00.000Z' });
    });

    it('says when nothing is lapsing', async () => {
      const { service } = makeLapse();
      expect(await service.status(T)).toEqual({ lapsing: false });
    });
  });
});
