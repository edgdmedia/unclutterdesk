import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { joinLinkFor } from '../video/room-links';
import { tenantWebOrigin } from '../../common/origins';

const HOUR = 3_600_000;

/** NOT-07 (decided 2 Oct 2026): a session is reminded 24 hours and 1 hour before. */
export const SESSION_REMINDERS = [
  { kind: '24h', before: 24 * HOUR },
  { kind: '1h', before: HOUR },
] as const;

export type ReminderKind = (typeof SESSION_REMINDERS)[number]['kind'];

/**
 * Which reminder a session is due now, if any.
 *
 * - Only once its moment has come (`startsAt - before`), and while the
 *   session is still ahead.
 * - Not when the session was booked after that moment: someone who books at
 *   18:00 for 20:00 just had their confirmation and gets no "tomorrow" email,
 *   though the 1-hour one still comes at 19:00.
 * - The 24-hour one is skipped once the 1-hour one is due, so a late run
 *   (say after a deploy) never sends both together.
 */
export function dueReminder(b: { startsAt: Date; createdAt: Date }, now: Date): ReminderKind | null {
  const ahead = b.startsAt.getTime() - now.getTime();
  if (ahead <= 0) return null;
  for (const r of [...SESSION_REMINDERS].sort((a, z) => a.before - z.before)) {
    const moment = b.startsAt.getTime() - r.before;
    if (ahead <= r.before) return b.createdAt.getTime() < moment ? r.kind : null;
  }
  return null;
}

/**
 * Session reminders with the join link (NOT-07). Every five minutes the
 * sessions due a reminder are queued on the notification hub, which sends
 * within a minute. The dedupe key carries the start time, so a reminder goes
 * once per time: a moved session is reminded again for its new time, and the
 * link is read when the reminder is made, so it is the current one (a Google
 * Meet link once the calendar push made it).
 *
 * Session reminders are not optional for the client (the decision says so),
 * so email and in-app are requested explicitly rather than left to the
 * reminders preference, which defaults email off.
 */
@Injectable()
export class SessionReminderService {
  private readonly logger = new Logger(SessionReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run(now = new Date()): Promise<number> {
    const rows = await this.prisma.consultBooking.findMany({
      where: {
        status: 'CONFIRMED',
        availability: { startsAt: { gt: now, lte: new Date(now.getTime() + 24 * HOUR) } },
      },
      include: {
        client: { select: { id: true, email: true, timezone: true } },
        service: { select: { title: true } },
        tenant: { select: { name: true, slug: true, customDomain: true, customDomainStatus: true } },
        location: { select: { name: true, address: true, city: true } },
        availability: { select: { startsAt: true, therapist: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
      },
      take: 500,
    });

    let queued = 0;
    for (const b of rows as any[]) {
      const kind = dueReminder({ startsAt: b.availability.startsAt, createdAt: b.createdAt }, now);
      if (!kind || !b.client?.email) continue;
      try {
        await this.notifications.queueReminder(this.reminderFor(b, kind), `session-reminder:${kind}:${b.id}:${b.availability.startsAt.getTime()}`);
        queued++;
      } catch (err) {
        this.logger.warn(`Could not queue the ${kind} reminder for booking ${b.id}: ${(err as Error).message}`);
      }
    }
    return queued;
  }

  private reminderFor(b: any, kind: ReminderKind) {
    const timeZone = b.client.timezone || 'Africa/Lagos';
    const at = b.availability.startsAt as Date;
    const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone }).format(at);
    const day = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(at);
    const practitioner = `${b.availability.therapist?.profile?.firstName ?? ''} ${b.availability.therapist?.profile?.lastName ?? ''}`.trim();
    const withWhom = practitioner ? ` with ${practitioner}` : '';
    const when = kind === '1h' ? `in an hour, at ${time}` : `on ${day} at ${time}`;
    const origin = tenantWebOrigin(b.tenant);
    const inPerson = b.format === 'IN_PERSON';
    const join = inPerson ? null : joinLinkFor(origin, b);
    const where = inPerson
      ? b.location
        ? `It is in person at ${b.location.name}, ${[b.location.address, b.location.city].filter(Boolean).join(', ')}.`
        : 'It is in person.'
      : `Join here: ${join}`;
    return {
      tenantId: b.tenantId as bigint,
      profileId: b.client.id as bigint,
      type: `consult.session_reminder_${kind}`,
      title: kind === '1h' ? `Your session starts at ${time}` : `Reminder: your session on ${day}`,
      message: `Your ${b.service.title}${withWhom} is ${when}.\n${where}\n\n— ${b.tenant.name}`,
      link: join ?? `${origin}/portal`,
      actionLabel: join ? 'Join the session' : 'View my booking',
      preferenceCategory: 'reminders' as const,
      channels: { email: true, in_app: true },
      triggerAt: new Date(),
    };
  }
}
