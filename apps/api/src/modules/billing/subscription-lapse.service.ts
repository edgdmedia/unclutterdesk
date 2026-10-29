import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { formatLagosDate } from '../../common/lagos-time';
import { TIER_NAMES, effectiveTier, isPaidTier, PLAN_SELECT, type Tier } from '../entitlements/entitlements';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days a lapsed paid plan is kept before the downgrade notice starts (default 7). */
export function billingGraceDays(): number {
  return configuredDays('BILLING_GRACE_DAYS', 7);
}

/** Days of notice, with the exact date, before the move to FREE (default 14). */
export function billingNoticeDays(): number {
  return configuredDays('BILLING_NOTICE_DAYS', 14);
}

function configuredDays(name: string, fallback: number): number {
  const days = Number(process.env[name]);
  return Number.isFinite(days) && days >= 0 ? days : fallback;
}

/** The roles a downgrade to FREE pauses: everyone but the owner and clients (§5.4a). */
const PAUSED_ROLES = ['ADMIN', 'RECEPTIONIST', 'THERAPIST'];

/**
 * The lapse timeline for paid plans (spec §5.4a):
 *
 *   day 0   payment fails, or the paid period ends after cancellation
 *   0–7     grace: plan kept, owner reminded
 *   7–21    notice: plan kept, owner told the exact date, sees the upcoming
 *           sessions with staff who will be paused
 *   21      move to FREE; every active membership except the owner paused
 *
 * Paying again at any point stops it, and reactivates only the memberships the
 * downgrade paused. Every email is queued when the lapse starts, with a
 * dedupe key, and cancelled through the same keys if the practice pays.
 */
@Injectable()
export class SubscriptionLapseService {
  private readonly logger = new Logger(SubscriptionLapseService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationService,
  ) {}

  /**
   * Starts the timeline with day 0 at `lapsedAt` (which may be in the future:
   * a cancelled subscription lapses when its paid period ends). Does nothing
   * if the practice is already lapsing, is not on a paid plan, or has a
   * complimentary plan in force (INTERNAL included).
   */
  async startLapse(tenantId: bigint, lapsedAt: Date): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, subscriptionLapsedAt: true, ...PLAN_SELECT },
    });
    if (!tenant || tenant.subscriptionLapsedAt) return false;
    const tier = effectiveTier(tenant);
    if (!isPaidTier(tier) || tenant.complimentaryReason === 'INTERNAL' || tenant.complimentaryUntil) return false;

    const noticeFrom = new Date(lapsedAt.getTime() + billingGraceDays() * DAY_MS);
    const downgradeAt = new Date(noticeFrom.getTime() + billingNoticeDays() * DAY_MS);
    const claimed = await this.prisma.tenant.updateMany({
      where: { id: tenantId, subscriptionLapsedAt: null },
      data: { subscriptionLapsedAt: lapsedAt, downgradeAt },
    });
    if (claimed.count === 0) return false; // another path started it first

    const plan = TIER_NAMES[tier];
    const date = formatLagosDate(downgradeAt);
    const graceReminder = new Date(lapsedAt.getTime() + Math.floor(billingGraceDays() / 2) * DAY_MS);
    await this.queueForOwner(tenantId, lapsedAt, [
      {
        step: 'start',
        triggerAt: lapsedAt,
        title: `Your ${plan} subscription needs attention`,
        message: `We couldn't renew your ${plan} plan. Nothing changes yet: renew from Settings → Subscription and everything carries on as it is.`,
      },
      {
        step: 'grace',
        triggerAt: graceReminder,
        title: `Reminder: renew your ${plan} plan`,
        message: `Your ${plan} plan still hasn't renewed. Renew from Settings → Subscription to keep your bookings, staff and settings as they are.`,
      },
      {
        step: 'notice',
        triggerAt: noticeFrom,
        title: `Your practice moves to the free plan on ${date}`,
        message: `Unless your ${plan} plan is renewed, your practice moves to the free plan on ${date}. Everyone except you will be paused then, and the free plan takes 10 bookings a month. Check your dashboard for upcoming sessions with staff who will be paused.`,
      },
    ]);
    this.logger.log(`Tenant ${tenantId} lapse started; moves to FREE on ${downgradeAt.toISOString()}`);
    return true;
  }

  /**
   * The practice paid: stop the timeline, cancel its queued emails, and
   * reactivate the memberships the downgrade paused (and only those).
   */
  async stopLapse(tenantId: bigint): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subscriptionLapsedAt: true },
    });
    if (tenant?.subscriptionLapsedAt) {
      await this.notifications?.cancelRemindersWithPrefix(lapsePrefix(tenantId, tenant.subscriptionLapsedAt));
    }
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionLapsedAt: null, downgradeAt: null },
    });

    const paused = await this.prisma.profile.findMany({
      where: { tenantId, pausedByDowngradeAt: { not: null } },
      select: { id: true },
    });
    if (!paused.length) return;
    await this.prisma.profile.updateMany({
      where: { tenantId, pausedByDowngradeAt: { not: null } },
      data: { status: 'active', pausedByDowngradeAt: null },
    });
    await this.notify(tenantId, paused.map((p) => p.id), {
      type: 'billing.membership_reactivated',
      title: 'Your access is back',
      message: 'The practice has renewed its plan, so your account is active again. Sign in as usual.',
    });
    this.logger.log(`Tenant ${tenantId}: reactivated ${paused.length} membership(s) paused by a downgrade`);
  }

  /**
   * Daily: starts timelines the webhooks didn't (a cancelled subscription
   * whose paid period has ended, a renewal still unpaid) and moves practices
   * whose notice has run out to FREE.
   */
  async enforce(now: Date = new Date()) {
    // INTERNAL practices never lapse (§5.4): excluded explicitly, since a
    // null complimentaryUntil alone doesn't say "complimentary".
    const notInternal = { OR: [{ complimentaryReason: null }, { complimentaryReason: { not: 'INTERNAL' as const } }] };

    const unstarted = await this.prisma.tenant.findMany({
      where: {
        subscriptionTier: { not: 'FREE' },
        subscriptionLapsedAt: null,
        complimentaryUntil: null,
        AND: [
          notInternal,
          {
            OR: [
              { subscriptionStatus: 'past_due' },
              { subscriptionStatus: 'cancelled', subscriptionRenewsAt: { lte: now } },
            ],
          },
        ],
      },
      select: { id: true, subscriptionStatus: true, subscriptionRenewsAt: true },
    });
    let started = 0;
    for (const t of unstarted) {
      const day0 = t.subscriptionStatus === 'cancelled' && t.subscriptionRenewsAt ? t.subscriptionRenewsAt : now;
      if (await this.startLapse(t.id, day0)) started += 1;
    }

    const due = await this.prisma.tenant.findMany({
      where: { subscriptionTier: { not: 'FREE' }, downgradeAt: { lte: now }, AND: [notInternal] },
      select: { id: true },
    });
    let downgraded = 0;
    for (const t of due) {
      if (await this.moveToFree(t.id, now)) downgraded += 1;
    }
    if (started || downgraded) this.logger.log(`Lapse timeline: ${started} started, ${downgraded} moved to FREE`);
    return { started, downgraded };
  }

  /**
   * Day 21: FREE, with every active membership except the owner paused.
   * Their accounts, notes and history are kept. Upcoming sessions with paused
   * therapists are kept too, and the owner is emailed the list so none
   * silently stops working.
   */
  async moveToFree(tenantId: bigint, now: Date = new Date()): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, downgradeAt: true, ...PLAN_SELECT },
    });
    if (!tenant || !tenant.downgradeAt || tenant.downgradeAt > now) return false;
    const from: Tier = effectiveTier(tenant);

    const toPause = await this.prisma.profile.findMany({
      where: { tenantId, status: 'active', role: { in: PAUSED_ROLES } },
      select: { id: true },
    });
    const sessions = await this.upcomingWithPaused(tenantId, now);

    await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: { subscriptionTier: 'FREE', subscriptionLapsedAt: null, downgradeAt: null },
      }),
      this.prisma.profile.updateMany({
        where: { id: { in: toPause.map((p) => p.id) } },
        data: { status: 'inactive', pausedByDowngradeAt: now },
      }),
    ]);

    await this.notify(tenantId, await this.ownerIds(tenantId), {
      type: 'billing.downgraded',
      title: 'Your practice is now on the free plan',
      message:
        `Your ${TIER_NAMES[from]} plan has ended. Your clients, notes and bookings are all still here; the free plan takes 10 bookings a month.` +
        (toPause.length ? ` ${toPause.length} team member${toPause.length === 1 ? ' has' : 's have'} been paused; renewing reactivates them.` : '') +
        (sessions.length
          ? ` ${sessions.length} upcoming session${sessions.length === 1 ? ' is' : 's are'} still booked with paused staff: ${sessions
              .map((s) => `${s.clientName} with ${s.practitionerName} on ${formatLagosDate(s.startsAt)}`)
              .join('; ')}. Reassign, reschedule or cancel them from your dashboard.`
          : ''),
    });
    await this.notify(tenantId, toPause.map((p) => p.id), {
      type: 'billing.membership_paused',
      title: 'Your access to the practice is paused',
      message: "The practice's paid plan has ended, so your account there is paused. Nothing is deleted; it comes back if the practice renews.",
      emailOnly: true,
    });
    this.logger.log(`Tenant ${tenantId} moved to FREE; ${toPause.length} membership(s) paused`);
    return true;
  }

  /**
   * What the owner's dashboard shows while a lapse runs: the dates, and in
   * the notice period the future sessions with therapists who will be paused.
   */
  async status(tenantId: bigint, now: Date = new Date()) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subscriptionLapsedAt: true, downgradeAt: true },
    });
    if (!tenant?.subscriptionLapsedAt || !tenant.downgradeAt) return { lapsing: false as const };
    const noticeFrom = new Date(tenant.downgradeAt.getTime() - billingNoticeDays() * DAY_MS);
    const inNotice = now >= noticeFrom;
    const sessions = inNotice ? await this.upcomingWithPaused(tenantId, now) : [];
    return {
      lapsing: true as const,
      lapsedAt: tenant.subscriptionLapsedAt.toISOString(),
      noticeFrom: noticeFrom.toISOString(),
      downgradeAt: tenant.downgradeAt.toISOString(),
      inNotice,
      sessions: sessions.map((s) => ({ ...s, id: s.id.toString(), startsAt: s.startsAt.toISOString() })),
    };
  }

  /** Future, not-cancelled bookings whose therapist is a non-owner (so would be, or was, paused). */
  private async upcomingWithPaused(tenantId: bigint, now: Date) {
    const bookings = await this.prisma.consultBooking.findMany({
      where: {
        tenantId,
        status: { not: 'CANCELLED' },
        availability: { startsAt: { gt: now }, therapist: { profile: { role: { not: 'OWNER' } } } },
      },
      select: {
        id: true,
        client: { select: { firstName: true, lastName: true, email: true } },
        availability: {
          select: { startsAt: true, therapist: { select: { profile: { select: { firstName: true, lastName: true } } } } },
        },
      },
      orderBy: { availability: { startsAt: 'asc' } },
      take: 200,
    });
    return bookings.map((b) => ({
      id: b.id,
      startsAt: b.availability.startsAt,
      clientName: [b.client.firstName, b.client.lastName].filter(Boolean).join(' ') || b.client.email,
      practitionerName:
        [b.availability.therapist.profile.firstName, b.availability.therapist.profile.lastName].filter(Boolean).join(' ') ||
        'a team member',
    }));
  }

  private async ownerIds(tenantId: bigint): Promise<bigint[]> {
    const owners = await this.prisma.profile.findMany({ where: { tenantId, role: 'OWNER' }, select: { id: true } });
    return owners.map((o) => o.id);
  }

  private async queueForOwner(
    tenantId: bigint,
    lapsedAt: Date,
    steps: Array<{ step: string; triggerAt: Date; title: string; message: string }>,
  ) {
    if (!this.notifications) return;
    const owners = await this.ownerIds(tenantId);
    for (const ownerId of owners) {
      for (const s of steps) {
        await this.notifications.queueReminder(
          {
            tenantId,
            profileId: ownerId,
            type: `billing.lapse_${s.step}`,
            title: s.title,
            message: s.message,
            link: '/dashboard/settings/subscription',
            actionLabel: 'Renew plan',
            channels: { in_app: true, email: true },
            triggerAt: s.triggerAt,
          },
          `${lapsePrefix(tenantId, lapsedAt)}${s.step}:${ownerId}`,
        );
      }
    }
  }

  private async notify(
    tenantId: bigint,
    profileIds: bigint[],
    n: { type: string; title: string; message: string; emailOnly?: boolean },
  ) {
    if (!profileIds.length || !this.notifications) return;
    try {
      await this.notifications.notify({
        tenantId,
        profileIds,
        type: n.type,
        title: n.title,
        message: n.message,
        link: '/dashboard/settings/subscription',
        channels: { in_app: !n.emailOnly, email: true, push: false },
      });
    } catch (err) {
      this.logger.warn(`Could not send ${n.type} to tenant ${tenantId}: ${(err as Error).message}`);
    }
  }
}

/** Every email key for one lapse starts with this; each adds `{step}:{ownerId}`, so it's queued once and cancelled together. */
export function lapsePrefix(tenantId: bigint, lapsedAt: Date): string {
  return `lapse:${tenantId}:${lapsedAt.toISOString().slice(0, 10)}:`;
}
