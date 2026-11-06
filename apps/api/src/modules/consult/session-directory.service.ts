import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { isMeetLink, roomResetOnMove, staffRoomPath } from '../video/room-links';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { BookingNotifier } from '../notifications/booking-notifier.service';
import { chargedKobo } from '../../common/revenue';
import { tenantWebOrigin } from '../../common/origins';
import { formatNaira } from '../billing/subscription-plans';
import { priceFor, type Format } from './formats';
import { isUnpaid, moneyAfterServiceChange } from './service-change';

export interface SessionActor {
  profileId: bigint;
  viewAll: boolean;
  clinical?: boolean;
  desk?: boolean;
}

const name = (p: { firstName?: string | null; lastName?: string | null } | null | undefined, fallback = 'Client') =>
  `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || fallback;

/** The Lagos calendar date of a moment, as the UTC midnight a DATE column stores. */
function lagosDay(moment: Date): Date {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(moment);
  return new Date(`${key}T00:00:00.000Z`);
}


/**
 * The practice's session register and the single-session view: the same rows
 * the schedule feed shows, but scoped by permission rather than by one
 * practitioner's diary, and joined with what the session page needs.
 */
@Injectable()
export class SessionDirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    @Optional() private readonly notifier?: BookingNotifier,
  ) {}

  private include() {
    return {
      client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      service: { select: { id: true, title: true, durationMinutes: true } },
      availability: { include: { therapist: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
      location: { select: { id: true, name: true, city: true } },
      clinicalNotes: { select: { id: true, isLocked: true }, take: 1, orderBy: { createdAt: 'desc' as const } },
    };
  }

  private shape(b: any, bookedBy: string | null) {
    return {
      id: b.id.toString(),
      startsAt: b.availability.startsAt.toISOString(),
      endsAt: b.availability.endsAt.toISOString(),
      status: b.status as string,
      paymentMethod: b.paymentMethod as string,
      amountKobo: b.amountKobo !== null && b.amountKobo !== undefined ? String(b.amountKobo) : null,
      holdExpiresAt: b.holdExpiresAt ? b.holdExpiresAt.toISOString() : null,
      bookedBy,
      client: { id: b.client.id.toString(), name: name(b.client) },
      serviceTitle: b.service.title,
      serviceId: b.service.id?.toString?.() ?? null,
      durationMinutes: (b.service.durationMinutes as number | undefined) ?? null,
      // After a change to a dearer service: what is still owed, and how it was settled.
      balanceKobo: b.balanceKobo !== null && b.balanceKobo !== undefined ? String(b.balanceKobo) : null,
      balanceStatus: (b.balanceStatus as 'DUE' | 'PAID' | 'WAIVED' | null | undefined) ?? null,
      provider: {
        id: b.availability.providerProfileId?.toString?.() ?? '',
        name: name(b.availability.therapist?.profile, 'Practitioner'),
      },
      channel: b.availability.channel as string,
      // SET-06: rows predating the format column read as online.
      format: (b.format as string | null) ?? 'ONLINE',
      location: b.location ? { id: b.location.id.toString(), name: b.location.name, city: b.location.city } : null,
    };
  }

  private async bookedBy(tenantId: bigint, createdByProfileId: bigint | null): Promise<string | null> {
    if (!createdByProfileId) return null;
    const creator = await this.prisma.profile.findFirst({
      where: { id: createdByProfileId, tenantId },
      select: { firstName: true, lastName: true },
    });
    return name(creator, 'Staff');
  }

  async listSessions(
    tenantId: bigint,
    actor: SessionActor,
    q: { status?: 'upcoming' | 'past' | 'all'; providerProfileId?: bigint; search?: string } = {},
  ) {
    const now = new Date();
    const where: any = { tenantId };
    where.availability = actor.viewAll
      ? q.providerProfileId ? { providerProfileId: q.providerProfileId } : {}
      : { providerProfileId: actor.profileId };
    if (q.status === 'upcoming') {
      where.availability.startsAt = { gte: now };
      where.status = { not: 'CANCELLED' };
    } else if (q.status === 'past') {
      where.availability.startsAt = { lt: now };
    }
    const s = q.search?.trim().toLowerCase();
    if (s) {
      where.OR = [
        { client: { firstName: { contains: s, mode: 'insensitive' } } },
        { client: { lastName: { contains: s, mode: 'insensitive' } } },
        { client: { email: { contains: s, mode: 'insensitive' } } },
        { service: { title: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.consultBooking.findMany({
      where,
      include: this.include(),
      orderBy: { availability: { startsAt: q.status === 'past' ? 'desc' : 'asc' } },
      take: 500,
    });

    const out = [];
    for (const b of rows) out.push(this.shape(b, await this.bookedBy(tenantId, b.createdByProfileId)));
    return out;
  }

  async getSession(tenantId: bigint, actor: SessionActor, bookingId: bigint) {
    const b = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId, ...(actor.viewAll ? {} : { availability: { providerProfileId: actor.profileId } }) },
      include: this.include(),
    });
    if (!b) throw new NotFoundException('Session not found');
    const note = b.clinicalNotes[0];
    return {
      ...this.shape(b, await this.bookedBy(tenantId, b.createdByProfileId)),
      clientEmail: b.client.email,
      clientPhone: b.client.phone,
      // VID-01: online sessions open their room in the app, or the therapist's Google Meet.
      videoRoomLink: b.format === 'IN_PERSON' ? null : isMeetLink(b.videoRoomName) ? b.videoRoomName : staffRoomPath(b.id),
      note: note ? { id: note.id.toString(), status: note.isLocked ? 'COMPLETED' : 'DRAFT' } : null,
      internalSummary: b.internalSummary,
      clientRecap: b.clientRecap,
      clientRecapSentAt: b.clientRecapSentAt ? b.clientRecapSentAt.toISOString() : null,
      can: {
        edit: actor.viewAll === true,
        summary: actor.clinical === true,
        markPaid: actor.desk === true,
      },
    };
  }

  /** The desk moves and closes sessions; a therapist only closes their own. */
  async setStatus(
    tenantId: bigint,
    actor: SessionActor,
    bookingId: bigint,
    status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED',
  ) {
    const b = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId, ...(actor.viewAll ? {} : { availability: { providerProfileId: actor.profileId } }) },
      select: { id: true, availabilityId: true },
    });
    if (!b) throw new NotFoundException('Session not found');
    if (!actor.viewAll && status !== 'COMPLETED') {
      throw new ForbiddenException('You can only mark your own sessions complete. Ask the front desk to confirm or cancel a session.');
    }
    await this.prisma.consultBooking.updateMany({ where: { id: b.id, tenantId }, data: { status } });
    if (status === 'CANCELLED') {
      await this.notifier?.notifyStaff(b.id, 'cancelled').catch(() => undefined);
      // The time goes back on the shelf, as the expiry cron does.
      await this.prisma.consultAvailability.updateMany({
        where: { id: b.availabilityId, tenantId },
        data: { isActive: true },
      });
    }
    return { id: b.id.toString(), status };
  }

  /**
   * Staff move a session to another open slot of the same practitioner. With
   * `toOwnSlot`, the slot may instead be the actor's own: how an owner takes
   * over a session from a therapist who is about to be paused (§5.4a).
   */
  async rescheduleByStaff(
    tenantId: bigint,
    actor: SessionActor,
    bookingId: bigint,
    to: bigint | { startsAt: Date },
    opts: { toOwnSlot?: boolean } = {},
  ) {
    const moved = await this.prisma.$transaction(async (tx: any) => {
      const b = await tx.consultBooking.findFirst({
        where: { id: bookingId, tenantId },
        select: { id: true, status: true, availabilityId: true, serviceId: true, format: true, locationId: true, videoProvider: true, service: { select: { durationMinutes: true } } },
      });
      if (!b) throw new NotFoundException('Session not found');
      if (b.status === 'CANCELLED' || b.status === 'COMPLETED') {
        throw new BadRequestException('A cancelled or completed session cannot be moved.');
      }
      const oldSlot = await tx.consultAvailability.findFirst({ where: { id: b.availabilityId }, select: { providerProfileId: true } });
      // A therapist may move their own session without view-all. Moving another
      // practitioner's booking still needs the front desk or a practice admin.
      if (!actor.viewAll && oldSlot?.providerProfileId !== actor.profileId) {
        throw new ForbiddenException('Ask the front desk or a practice admin to move a session.');
      }
      if (typeof to !== 'bigint') {
        return this.moveToChosenTime(tx, tenantId, b, oldSlot.providerProfileId, to.startsAt);
      }
      const slot = await tx.consultAvailability.findFirst({ where: { id: to, tenantId } });
      if (!slot || !slot.isActive || slot.startsAt <= new Date()) {
        throw new BadRequestException('That time is no longer open. Choose another.');
      }
      if (opts.toOwnSlot) {
        if (slot.providerProfileId !== actor.profileId) throw new BadRequestException('Pick one of your own open times.');
      } else if (slot.providerProfileId !== oldSlot?.providerProfileId) {
        throw new BadRequestException('Pick an open time from the same practitioner.');
      }
      if (slot.serviceId !== null && slot.serviceId !== b.serviceId) {
        throw new BadRequestException('That time is kept for a different service. Choose another.');
      }
      const day = lagosDay(slot.startsAt);
      const away = await tx.timeOff.findFirst({
        where: { tenantId, profileId: slot.providerProfileId, startsOn: { lte: day }, endsOn: { gte: day } },
        select: { id: true },
      });
      if (away) throw new BadRequestException('The practice is away on that day. Choose another time.');
      // SET-06: a move keeps the bought format; the place comes with the time.
      if (b.format === 'IN_PERSON' && (!slot.allowsInPerson || !slot.locationId)) {
        throw new BadRequestException("That time isn't available in person. Choose another.");
      }
      if ((b.format ?? 'ONLINE') === 'ONLINE' && slot.allowsOnline === false) {
        throw new BadRequestException("That time isn't available online. Choose another.");
      }
      await this.releaseOldTime(tx, tenantId, b.availabilityId);
      await tx.consultAvailability.update({ where: { id: slot.id }, data: { isActive: false } });
      await tx.consultBooking.update({
        where: { id: b.id },
        data: { availabilityId: slot.id, ...(b.format === 'IN_PERSON' ? { locationId: slot.locationId } : {}), ...roomResetOnMove(b) },
      });
      return { id: b.id.toString(), startsAt: slot.startsAt.toISOString() };
    });
    // Best effort: the session has moved; a mail outage must not report failure.
    await this.emailMoved(tenantId, bookingId).catch(() => undefined);
    return moved;
  }

  /**
   * Gives the old time back to the pool, unless staff made it by hand for this
   * booking alone: that time may be outside working hours.
   */
  private async releaseOldTime(tx: any, tenantId: bigint, availabilityId: bigint) {
    await tx.consultAvailability.updateMany({ where: { id: availabilityId, tenantId, createdForBooking: false }, data: { isActive: true } });
  }

  /**
   * Staff move a session to a time they choose, not one of the open times: the
   * client asked for a time the weekly hours don't offer. The same lock and
   * clash rules as a staff booking at a chosen time, so the two cannot
   * double-book. The new time lasts as long as the service.
   */
  private async moveToChosenTime(
    tx: any,
    tenantId: bigint,
    b: { id: bigint; availabilityId: bigint; serviceId: bigint; format: string | null; locationId: bigint | null; videoProvider?: string | null; service: { durationMinutes: number } },
    providerId: bigint,
    startsAt: Date,
  ) {
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Enter a valid time.');
    if (startsAt.getTime() <= Date.now()) throw new BadRequestException('Choose a time in the future.');
    const endsAt = new Date(startsAt.getTime() + b.service.durationMinutes * 60_000);

    const day = lagosDay(startsAt);
    const away = await tx.timeOff.findFirst({
      where: { tenantId, profileId: providerId, startsOn: { lte: day }, endsOn: { gte: day } },
      select: { id: true },
    });
    if (away) throw new BadRequestException('The practice is away on that day. Choose another time.');

    const lockKey = `staff-booking:${tenantId}:${providerId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

    // The old time goes back first, so that if it overlaps the new time the
    // close below shuts it again.
    await this.releaseOldTime(tx, tenantId, b.availabilityId);
    // Close overlapping open times BEFORE the clash check: this waits on any
    // public booking mid-claim of one, so the check then sees it.
    await tx.consultAvailability.updateMany({
      where: { tenantId, providerProfileId: providerId, isActive: true, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      data: { isActive: false },
    });
    const clash = await tx.consultBooking.findFirst({
      where: {
        tenantId,
        id: { not: b.id },
        status: { not: 'CANCELLED' },
        availability: { providerProfileId: providerId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      },
      include: { availability: { include: { therapist: { select: { profile: { select: { firstName: true, lastName: true, timezone: true } } } } } } },
    });
    if (clash) {
      const profile = clash.availability.therapist?.profile;
      const hhmm = (d: Date) =>
        new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: profile?.timezone || 'Africa/Lagos' }).format(d);
      throw new BadRequestException(
        `${name(profile, 'This practitioner')} already has a session from ${hhmm(clash.availability.startsAt)} to ${hhmm(clash.availability.endsAt)}. Choose another time.`,
      );
    }

    // SET-06: the move keeps the bought format; in person stays at its place.
    const inPerson = b.format === 'IN_PERSON';
    const slot = await tx.consultAvailability.create({
      data: {
        tenantId,
        providerProfileId: providerId,
        serviceId: b.serviceId,
        startsAt,
        endsAt,
        allowsOnline: !inPerson,
        allowsInPerson: inPerson,
        locationId: inPerson ? b.locationId : null,
        channel: inPerson ? 'IN_PERSON' : 'VIDEO',
        isActive: false,
        createdForBooking: true,
      },
    });
    await tx.consultBooking.update({ where: { id: b.id }, data: { availabilityId: slot.id, ...roomResetOnMove(b) } });
    return { id: b.id.toString(), startsAt: slot.startsAt.toISOString() };
  }

  /** Tells the client their session has a new time. */
  private async emailMoved(tenantId: bigint, bookingId: bigint) {
    const b = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId },
      include: { client: true, service: true, availability: true },
    });
    if (!b?.client?.email) return;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true, customDomain: true, customDomainStatus: true },
    });
    const when = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: b.client.timezone || 'Africa/Lagos',
    }).format(b.availability.startsAt);
    await this.notifications.sendEmail({
      to: b.client.email,
      type: 'bookings.rescheduled',
      title: `Your session has moved to ${when}`,
      message: `${tenant?.name ?? 'Your practice'} has moved your ${b.service.title} session to ${when}.`,
      link: `${tenantWebOrigin(tenant as any)}/portal`,
      actionLabel: 'View my booking',
      tenantId,
      profileId: b.client.id,
    });
  }

  /**
   * The client booked the wrong service: staff put it right. Same permission as
   * a move (the desk, or the practitioner for their own session). The time
   * stretches to the new length when the practitioner is free for it; the
   * money follows `moneyAfterServiceChange`. The client is emailed.
   */
  async changeService(tenantId: bigint, actor: SessionActor, bookingId: bigint, serviceId: bigint) {
    const result = await this.prisma.$transaction(async (tx: any) => {
      const b = await tx.consultBooking.findFirst({
        where: { id: bookingId, tenantId },
        include: {
          availability: { include: { therapist: { select: { profile: { select: { firstName: true, lastName: true, timezone: true } } } } } },
        },
      });
      if (!b) throw new NotFoundException('Session not found');
      const slot = b.availability;
      if (!actor.viewAll && slot.providerProfileId !== actor.profileId) {
        throw new ForbiddenException("Ask the front desk or a practice admin to change another practitioner's session.");
      }
      if (b.status === 'CANCELLED') throw new BadRequestException('A cancelled session cannot be changed. Book a new one.');
      if (b.serviceId === serviceId) throw new BadRequestException('The session is already for that service.');

      const service = await tx.consultService.findFirst({ where: { id: serviceId, tenantId, isActive: true }, include: { formats: true } });
      if (!service) throw new BadRequestException('That service is not offered. Choose another.');
      const format = (b.format ?? 'ONLINE') as Format;
      // As a staff booking prices it: the format's price, or the old single price online.
      const price = priceFor(service.formats ?? [], format) ?? (format === 'ONLINE' ? BigInt(service.priceKobo ?? 0) : null);
      if (price === null) throw new BadRequestException('That service is not offered in person. Choose another.');

      // The time: only a session still ahead changes length.
      let endsAt: Date = slot.endsAt;
      if (slot.startsAt > new Date()) {
        const wanted = new Date(slot.startsAt.getTime() + service.durationMinutes * 60_000);
        if (wanted > slot.endsAt) {
          // The same lock as a staff custom time, so the two cannot double-book.
          const lockKey = `staff-booking:${tenantId}:${slot.providerProfileId}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
          // Close open times in the added stretch FIRST, so a public booking
          // mid-claim of one commits before the clash check below reads it.
          await tx.consultAvailability.updateMany({
            where: { tenantId, providerProfileId: slot.providerProfileId, isActive: true, id: { not: slot.id }, startsAt: { lt: wanted }, endsAt: { gt: slot.endsAt } },
            data: { isActive: false },
          });
          const clash = await tx.consultBooking.findFirst({
            where: {
              tenantId,
              id: { not: b.id },
              status: { not: 'CANCELLED' },
              availability: { providerProfileId: slot.providerProfileId, startsAt: { lt: wanted }, endsAt: { gt: slot.endsAt } },
            },
            include: { availability: true },
          });
          if (clash) {
            const tz = slot.therapist?.profile?.timezone || 'Africa/Lagos';
            const hhmm = (d: Date) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(d);
            throw new BadRequestException(
              `${name(slot.therapist?.profile, 'The practitioner')} has another session from ${hhmm(clash.availability.startsAt)} to ${hhmm(clash.availability.endsAt)}, so ${service.title} (${service.durationMinutes} min) doesn't fit. Reschedule the session first.`,
            );
          }
        }
        if (wanted.getTime() !== slot.endsAt.getTime()) {
          // A shorter session's freed minutes are not reopened: too short to book.
          await tx.consultAvailability.update({
            where: { id: slot.id },
            data: { endsAt: wanted, ...(slot.serviceId !== null ? { serviceId: service.id } : {}) },
          });
          endsAt = wanted;
        }
      }

      const money = moneyAfterServiceChange(b, price);
      await tx.consultBooking.update({
        where: { id: b.id },
        data: {
          serviceId: service.id,
          amountKobo: money.amountKobo,
          balanceKobo: money.balanceKobo,
          balanceStatus: money.balanceStatus,
          balanceSettledAt: null,
          balanceSettledByProfileId: null,
          updatedAt: new Date(),
        },
      });
      return {
        id: b.id.toString(),
        serviceTitle: service.title as string,
        durationMinutes: service.durationMinutes as number,
        startsAt: slot.startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        priceKobo: price.toString(),
        amountKobo: money.amountKobo.toString(),
        unpaid: isUnpaid(b),
        balanceKobo: money.balanceKobo !== null ? money.balanceKobo.toString() : null,
        balanceStatus: money.balanceStatus,
        overpaidKobo: money.overpaidKobo.toString(),
        clientProfileId: b.clientProfileId as bigint,
        upcoming: slot.startsAt > new Date(),
      };
    });

    const { clientProfileId, upcoming, ...out } = result;
    if (upcoming) {
      await this.emailServiceChange(tenantId, clientProfileId, out).catch(() => undefined);
    }
    return out;
  }

  /** Tells the client what their session is now, and what (if anything) is owed. */
  private async emailServiceChange(
    tenantId: bigint,
    clientProfileId: bigint,
    r: { serviceTitle: string; durationMinutes: number; startsAt: string; priceKobo: string; amountKobo: string; unpaid: boolean; balanceKobo: string | null },
  ) {
    const [client, tenant] = await Promise.all([
      this.prisma.profile.findUnique({ where: { id: clientProfileId }, select: { email: true, timezone: true } }),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true, customDomain: true, customDomainStatus: true } }),
    ]);
    if (!client?.email) return;
    const when = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: client.timezone || 'Africa/Lagos',
    }).format(new Date(r.startsAt));
    const money = r.unpaid
      ? ` The amount to pay is now ${formatNaira(Number(r.amountKobo))}.`
      : r.balanceKobo
        ? ` The new price is ${formatNaira(Number(r.priceKobo))}. You have paid ${formatNaira(Number(r.amountKobo))}, so ${formatNaira(Number(r.balanceKobo))} is still due; the practice will tell you how to pay it.`
        : '';
    await this.notifications.sendEmail({
      to: client.email,
      type: 'bookings.service_changed',
      title: `Your session on ${when} is now ${r.serviceTitle}`,
      message: `${tenant?.name ?? 'Your practice'} has changed your session on ${when} to ${r.serviceTitle} (${r.durationMinutes} minutes).${money}`,
      link: `${tenantWebOrigin(tenant as any)}/portal`,
      actionLabel: 'View my booking',
      tenantId,
      profileId: clientProfileId,
    });
  }

  /** The desk settles a balance left by a service change: paid at the practice, or waived. */
  async settleBalance(tenantId: bigint, actorProfileId: bigint, bookingId: bigint, action: 'PAID' | 'WAIVED') {
    const b = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId },
      select: { id: true, amountKobo: true, paidAt: true, balanceKobo: true, balanceStatus: true, service: { select: { priceKobo: true } } },
    });
    if (!b) throw new NotFoundException('Session not found');
    if (b.balanceStatus !== 'DUE' || !b.balanceKobo) throw new BadRequestException('Nothing is owed on this session.');
    const now = new Date();
    const data =
      action === 'PAID'
        ? // Folded into what was collected, so revenue and the client's payments count it.
          { amountKobo: chargedKobo(b) + b.balanceKobo, paidAt: b.paidAt ?? now, balanceStatus: 'PAID' }
        : { balanceStatus: 'WAIVED' };
    // The status is part of the match: two clicks settle it once.
    const done = await this.prisma.consultBooking.updateMany({
      where: { id: b.id, tenantId, balanceStatus: 'DUE' },
      data: { ...data, balanceSettledAt: now, balanceSettledByProfileId: actorProfileId },
    });
    if (done.count !== 1) throw new BadRequestException('Nothing is owed on this session.');
    return { id: b.id.toString(), balanceStatus: action };
  }

  async setSummary(
    tenantId: bigint,
    actor: SessionActor,
    bookingId: bigint,
    dto: { internalSummary?: string | null; clientRecap?: string | null },
  ) {
    const b = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId, ...(actor.viewAll ? {} : { availability: { providerProfileId: actor.profileId } }) },
      select: { id: true },
    });
    if (!b) throw new NotFoundException('Session not found');
    const clean = (v: unknown) => (v === null || v === undefined ? null : String(v).trim().slice(0, 4000) || null);
    const data: Record<string, unknown> = {};
    if ('internalSummary' in dto) data.internalSummary = clean(dto.internalSummary);
    if ('clientRecap' in dto) data.clientRecap = clean(dto.clientRecap);
    await this.prisma.consultBooking.update({ where: { id: b.id }, data });
    return { id: b.id.toString() };
  }

  async sendRecap(tenantId: bigint, actor: SessionActor, bookingId: bigint) {
    const b = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId, ...(actor.viewAll ? {} : { availability: { providerProfileId: actor.profileId } }) },
      include: {
        client: { select: { id: true, email: true, firstName: true } },
        service: { select: { title: true } },
        availability: { select: { startsAt: true } },
      },
    });
    if (!b) throw new NotFoundException('Session not found');
    if (!b.clientRecap?.trim()) throw new BadRequestException('Write the recap before sending it.');
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true, customDomain: true, customDomainStatus: true },
    });
    await this.notifications.sendEmail({
      to: b.client.email,
      type: 'bookings.session_recap',
      title: `Your recap from ${b.service.title}`,
      message: `${b.client.firstName ?? 'There'}, here is the recap from your session on ${b.availability.startsAt.toDateString()}:\n\n${b.clientRecap.trim()}\n\n— ${tenant?.name ?? 'Your practice'}`,
      link: `${tenantWebOrigin(tenant as any)}/portal`,
      actionLabel: 'View my sessions',
      tenantId,
      profileId: b.client.id,
    });
    await this.prisma.consultBooking.update({ where: { id: b.id }, data: { clientRecapSentAt: new Date() } });
    return { id: b.id.toString(), sentAt: new Date().toISOString() };
  }

  /** One client's sessions for the client page — no clinical text. */
  async clientSessions(tenantId: bigint, actor: SessionActor, clientProfileId: bigint) {
    const rows = await this.prisma.consultBooking.findMany({
      where: { tenantId, clientProfileId },
      include: this.include(),
      orderBy: { availability: { startsAt: 'desc' } },
      take: 200,
    });
    const out = [];
    for (const b of rows) out.push(this.shape(b, await this.bookedBy(tenantId, b.createdByProfileId)));
    return out;
  }

  /** The client's billing history, for the desk: same rows the portal shows. */
  async clientPayments(tenantId: bigint, clientProfileId: bigint) {
    const bookings = await this.prisma.consultBooking.findMany({
      where: { tenantId, clientProfileId },
      include: { service: { select: { title: true, priceKobo: true } }, availability: { select: { startsAt: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const payments = bookings.map((booking: any) => ({
      bookingId: booking.id.toString(),
      serviceTitle: booking.service.title,
      sessionAt: booking.availability.startsAt.toISOString(),
      amountKobo: chargedKobo(booking).toString(),
      discountCode: booking.discountCodeUsed,
      status: booking.status,
      paidAt: booking.paidAt ? booking.paidAt.toISOString() : null,
      reference: booking.paymentRef,
      bookedAt: booking.createdAt.toISOString(),
    }));
    const paidKobo = payments.filter((p: any) => p.paidAt).reduce((t: bigint, p: any) => t + BigInt(p.amountKobo), 0n);
    const outstandingKobo = payments.filter((p: any) => p.status === 'PENDING_PAYMENT').reduce((t: bigint, p: any) => t + BigInt(p.amountKobo), 0n);
    return { payments, totalPaidKobo: paidKobo.toString(), outstandingKobo: outstandingKobo.toString() };
  }
}
