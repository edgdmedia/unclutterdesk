import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { joinLinkFor } from '../video/room-links';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { CalendarService } from '../calendar/calendar.service';
import { ConsultService } from './consult.service';
import { assertWithinMonthlyLimit } from './booking-limits';
import { lagosTomorrowStart } from '../../common/lagos-time';
import { paidAmount, parseStaffPayment, paymentsAllowed, payLinkToken, payLinkTokenValid, staffLinkHold } from './staff-booking-rules';
import { allowedFormats, asFormat, priceFor } from './formats';
import { chargedKobo } from '../../common/revenue';
import { tenantWebOrigin } from '../../common/origins';
import { formatNaira } from '../billing/subscription-plans';

export interface StaffBookingInput {
  clientProfileId: string;
  serviceId: string;
  providerProfileId?: string;
  availabilityId?: string;
  startsAt?: string;
  payment: string;
  amountKobo?: string;
  note?: string;
  notifyClient?: boolean;
  format?: string;
  locationId?: string | null;
}

export interface StaffBookingResult {
  bookingId: string;
  status: 'PENDING_PAYMENT' | 'CONFIRMED';
  paymentMethod: 'PAYSTACK' | 'MANUAL' | 'NONE';
  amountKobo: string;
  startsAt: string;
  endsAt: string;
  holdExpiresAt: string | null;
  serviceTitle: string;
  practitionerName: string;
  clientName: string;
  format: string;
  location: { id: string } | null;
}

/** One time in a request for several: an open slot, or a time staff choose. */
export interface StaffTimeInput {
  availabilityId?: string;
  startsAt?: string;
  format?: string;
  locationId?: string | null;
}

/** Several times for one client, with everything else as one booking. */
export type StaffSeveralInput = StaffBookingInput & { times?: StaffTimeInput[] };
export type StaffSeveralResult = { bookings: StaffBookingResult[] };

/** A client who paid for a block books part of it now; more than this is a plan (§11.2). */
export const MAX_TIMES_AT_ONCE = 8;

type BookingContext = Awaited<ReturnType<StaffBookingService['bookingContext']>>;

const id = (v: unknown, what: string): bigint => {
  if (!/^\d+$/.test(String(v ?? ''))) throw new BadRequestException(`Choose ${what}.`);
  return BigInt(String(v));
};
const fullName = (p: { firstName?: string | null; lastName?: string | null } | null | undefined) =>
  `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim();

type StaffBookingTime =
  | { kind: 'slot'; slotId: bigint; startsAt: Date; endsAt: Date; allowsOnline?: boolean | null; allowsInPerson?: boolean | null; locationId?: bigint | null }
  | { kind: 'custom'; startsAt: Date; endsAt: Date };

/**
 * Staff booking a session for a client already on the books: from the client's
 * page or the schedule, into an open slot or a time they choose, paid by a link
 * the client is sent, marked as already paid, or at no charge.
 */
@Injectable()
export class StaffBookingService {
  protected readonly logger = new Logger(StaffBookingService.name);

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly consult: ConsultService,
    protected readonly notifications: NotificationService,
    protected readonly calendar: CalendarService,
  ) {}

  async createForClient(tenantId: bigint, actorProfileId: bigint, dto: StaffBookingInput): Promise<StaffBookingResult> {
    const ctx = await this.bookingContext(tenantId, actorProfileId, dto);
    return (await this.bookTimes(tenantId, actorProfileId, dto, ctx.payment, ctx, [dto]))[0];
  }

  /** Who books, for whom, with whom and what: checked once however many times are booked. */
  async bookingContext(tenantId: bigint, actorProfileId: bigint, dto: StaffBookingInput) {
    const payment = parseStaffPayment(dto?.payment);
    const clientId = id(dto?.clientProfileId, 'a client');
    const serviceId = id(dto?.serviceId, 'a service');

    // The role is read here, not trusted from the token, as RolesGuard does.
    const actor = await this.prisma.profile.findFirst({
      where: { id: actorProfileId, tenantId, status: 'active' },
      select: { id: true, role: true, firstName: true, lastName: true },
    });
    if (!actor) throw new ForbiddenException('Your account cannot book sessions here.');
    const allowed = paymentsAllowed(actor.role);
    if (!allowed.length) throw new ForbiddenException('Your account cannot book sessions here.');
    if (!allowed.includes(payment)) {
      throw new ForbiddenException('Only the front desk or a practice admin can mark a session as paid.');
    }

    const providerId = dto.providerProfileId ? id(dto.providerProfileId, 'a practitioner') : actorProfileId;
    if (actor.role === 'THERAPIST' && providerId !== actorProfileId) {
      throw new ForbiddenException('You can only book sessions in your own diary.');
    }

    const client = await this.prisma.profile.findFirst({
      where: { id: clientId, tenantId, role: 'CLIENT', status: 'active' },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    const therapist = await this.prisma.consultTherapistProfile.findFirst({
      where: { profileId: providerId, tenantId, profile: { status: 'active' } },
      include: { profile: true, workLocations: { select: { locationId: true } } },
    });
    if (!therapist) throw new BadRequestException('Choose a practitioner in this practice.');

    const service = await this.prisma.consultService.findFirst({ where: { id: serviceId, tenantId, isActive: true }, include: { formats: true } });
    if (!service) throw new BadRequestException('That service is not offered. Choose another service.');

    return { payment, client, therapist, service, providerId };
  }

  /**
   * Several sessions for one client in one go: a client who paid for four
   * sessions books two now (today 20:00, tomorrow 14:00) and the rest later.
   * The same rules as one booking, applied to every time; all are booked or
   * none, and the client gets one email listing them.
   */
  async createSeveralForClient(
    tenantId: bigint,
    actorProfileId: bigint,
    dto: StaffSeveralInput,
  ): Promise<StaffSeveralResult> {
    const times = Array.isArray(dto?.times) ? dto.times : [];
    if (times.length === 0) throw new BadRequestException('Choose at least one time.');
    if (times.length > MAX_TIMES_AT_ONCE) throw new BadRequestException(`Book up to ${MAX_TIMES_AT_ONCE} sessions at once.`);
    const ctx = await this.bookingContext(tenantId, actorProfileId, dto);
    return { bookings: await this.bookTimes(tenantId, actorProfileId, dto, ctx.payment, ctx, times) };
  }

  /** One time, as one booking would have it: its slot or custom time, format, place and price. */
  private async planTime(
    tenantId: bigint,
    actorProfileId: bigint,
    dto: StaffBookingInput,
    payment: ReturnType<typeof parseStaffPayment>,
    ctx: BookingContext,
    t: StaffTimeInput,
    now: Date,
  ) {
    const { therapist, service, providerId } = ctx;
    const time = await this.resolveTime(tenantId, providerId, service, { ...dto, availabilityId: t.availabilityId, startsAt: t.startsAt });
    await this.consult.assertNotAway(tenantId, providerId, time.startsAt);

    // SET-06: the format follows the time and the therapist, decided here.
    const tf = {
      offersOnline: (therapist as any).offersOnline ?? true,
      offersInPerson: (therapist as any).offersInPerson ?? false,
      locationIds: (((therapist as any).workLocations ?? []) as Array<{ locationId: bigint }>).map((w) => w.locationId),
    };
    const legacy = (time as any).allowsOnline == null && (time as any).allowsInPerson == null;
    const allowedFmts = allowedFormats(
      {
        allowsOnline: legacy ? true : (time as any).allowsOnline,
        allowsInPerson: legacy ? false : (time as any).allowsInPerson,
        locationId: (time as any).locationId ?? null,
      },
      tf,
    );
    const possible = [allowedFmts.online && 'ONLINE', allowedFmts.inPerson && 'IN_PERSON'].filter(Boolean) as Array<'ONLINE' | 'IN_PERSON'>;
    const requested = asFormat(t.format ?? dto?.format);
    if (!requested) {
      if (possible.length !== 1) throw new BadRequestException('Choose online or in person.');
    } else if (!possible.includes(requested)) {
      throw new BadRequestException('That time does not offer this format. Choose another.');
    }
    const format: 'ONLINE' | 'IN_PERSON' = requested ?? possible[0];
    const wantedLocation = t.locationId ?? dto?.locationId;
    const locationId = format === 'IN_PERSON' ? (time as any).locationId ?? (wantedLocation ? BigInt(wantedLocation) : null) : null;
    if (format === 'IN_PERSON' && !locationId) throw new BadRequestException('Choose where the session happens.');

    const price = priceFor((service as any).formats ?? [], format) ?? (format === 'ONLINE' ? BigInt(service.priceKobo ?? 0) : null);
    if (price === null) throw new BadRequestException('That service is not offered in person. Choose another.');
    const free = price === 0n || payment === 'NONE';
    let hold: Date | null = null;
    if (!free && payment === 'LINK') {
      hold = staffLinkHold(now, time.startsAt);
      if (!hold) {
        throw new BadRequestException('This session starts too soon for a payment link. Mark it as paid, or as no charge.');
      }
    }
    const paymentData = free
      ? { status: 'CONFIRMED', paymentMethod: 'NONE', amountKobo: 0n }
      : payment === 'PAID'
        ? { status: 'CONFIRMED', paymentMethod: 'MANUAL', amountKobo: paidAmount(dto.amountKobo, price), paidAt: now, paymentConfirmedByProfileId: actorProfileId }
        : { status: 'PENDING_PAYMENT', paymentMethod: 'PAYSTACK', amountKobo: price, holdExpiresAt: hold };
    return { time, format, locationId, hold, paymentData };
  }

  private async bookTimes(
    tenantId: bigint,
    actorProfileId: bigint,
    dto: StaffBookingInput,
    payment: ReturnType<typeof parseStaffPayment>,
    ctx: BookingContext,
    times: StaffTimeInput[],
  ): Promise<StaffBookingResult[]> {
    const { client, therapist, service, providerId } = ctx;
    const now = new Date();
    const plans = [];
    for (const t of times) plans.push(await this.planTime(tenantId, actorProfileId, dto, payment, ctx, t, now));

    // §5.5: a session today (Lagos time) is never blocked by the month's
    // limit, though it counts; future ones follow the limit, together.
    const future = plans.filter((p) => p.time.startsAt >= lagosTomorrowStart(now));
    if (future.length) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      await assertWithinMonthlyLimit(this.prisma, tenantId, tenant, { sessionStartsAt: future[0].time.startsAt, adding: future.length });
    }

    const note = dto.note ? String(dto.note).trim().slice(0, 1000) || null : null;
    // All or none. Each claim sees the ones before it in this transaction, so
    // two chosen times that overlap are refused like any other clash.
    const bookings = await this.prisma.$transaction(async (tx) => {
      const made = [];
      for (const p of plans) {
        const slotId = await this.claimTime(tx, tenantId, providerId, service.id, p.time, fullName(therapist.profile), therapist.profile?.timezone || 'Africa/Lagos');
        made.push(
          await tx.consultBooking.create({
            data: {
              tenantId,
              serviceId: service.id,
              availabilityId: slotId,
              clientProfileId: client.id,
              createdByProfileId: actorProfileId,
              notes: note,
              format: p.format,
              locationId: p.locationId,
              ...p.paymentData,
            } as any,
          }),
        );
      }
      return made;
    });

    const results: StaffBookingResult[] = bookings.map((booking, i) => {
      const p = plans[i];
      return {
        bookingId: booking.id.toString(),
        status: p.paymentData.status as StaffBookingResult['status'],
        paymentMethod: p.paymentData.paymentMethod as StaffBookingResult['paymentMethod'],
        amountKobo: p.paymentData.amountKobo.toString(),
        startsAt: p.time.startsAt.toISOString(),
        endsAt: p.time.endsAt.toISOString(),
        holdExpiresAt: p.hold ? p.hold.toISOString() : null,
        serviceTitle: service.title,
        practitionerName: fullName(therapist.profile),
        clientName: fullName(client) || client.email,
        format: p.format,
        location: p.locationId ? { id: p.locationId.toString() } : null,
      };
    });

    // After commit, and never failing the booking.
    await this.afterBooking(results, dto.notifyClient !== false).catch((err) =>
      this.logger.warn(`After-booking steps failed for ${results.map((r) => r.bookingId).join(', ')}: ${(err as Error).message}`),
    );
    return results;
  }

  /**
   * Calendar first, then email: with Google Meet the push makes each
   * session's Meet link, and the emails should carry it. The client gets one
   * email (one per session while each needs its own payment link); the
   * practitioner always gets a copy, so a session booked for them by the desk
   * is never a surprise.
   */
  protected async afterBooking(results: StaffBookingResult[], notifyClient: boolean): Promise<void> {
    for (const r of results) {
      if (r.status === 'CONFIRMED') await this.calendar.pushBookingToGoogle(BigInt(r.bookingId)).catch(() => undefined);
    }
    const rows = await this.prisma.consultBooking.findMany({
      where: { id: { in: results.map((r) => BigInt(r.bookingId)) } },
      include: { client: true, tenant: true, location: true, availability: { include: { therapist: { include: { profile: true } } } } },
    });
    const byId = new Map(rows.map((b: any) => [b.id.toString(), b]));
    const sessions = results.map((r) => ({ r, b: byId.get(r.bookingId) as any })).filter((x) => x.b);
    if (!sessions.length) return;

    if (notifyClient) {
      try {
        const allConfirmed = sessions.every((x) => x.r.status === 'CONFIRMED');
        if (sessions.length > 1 && allConfirmed) await this.emailClientSeveral(sessions);
        else for (const x of sessions) await this.emailClientOne(x.b, x.r);
      } catch (err) {
        this.logger.warn(`Could not email the client about bookings ${results.map((r) => r.bookingId).join(', ')}: ${(err as Error).message}`);
      }
    }
    await this.emailPractitioner(sessions).catch((err) =>
      this.logger.warn(`Could not email the practitioner about bookings ${results.map((r) => r.bookingId).join(', ')}: ${(err as Error).message}`),
    );
  }

  /** How one session is reached: its join link (the Meet link once made), or its place. */
  private whereLine(b: any): string {
    if (b.format === 'IN_PERSON') return b.location ? `In person at ${b.location.name}, ${b.location.city}` : 'In person';
    return `Join: ${joinLinkFor(tenantWebOrigin(b.tenant), b)}`;
  }

  private when(at: Date | string, timeZone: string): string {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(at));
  }

  private async emailClientOne(b: any, r: StaffBookingResult): Promise<void> {
    const origin = tenantWebOrigin(b.tenant);
    // The client reads this, so their own time zone, not the server's or the practice's.
    const timeZone = b.client.timezone || 'Africa/Lagos';
    const when = this.when(r.startsAt, timeZone);
    if (r.status === 'PENDING_PAYMENT') {
      const deadline = r.holdExpiresAt
        ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(r.holdExpiresAt))
        : '';
      await this.notifications.sendEmail({
        to: b.client.email,
        type: 'bookings.staff_payment_link',
        title: `Pay for your session on ${when}`,
        message: `${b.tenant.name} has booked your ${r.serviceTitle} with ${r.practitionerName} on ${when}. Please pay ${formatNaira(Number(r.amountKobo))} by ${deadline} to keep this time.`,
        link: `${origin}/pay/${b.id}?t=${payLinkToken(b.id)}`,
        actionLabel: 'Pay now',
        tenantId: b.tenantId,
        profileId: b.clientProfileId,
      });
      return;
    }
    await this.notifications.sendEmail({
      to: b.client.email,
      type: 'bookings.staff_confirmed',
      title: 'Your session is booked',
      message: `${b.tenant.name} has booked your ${r.serviceTitle} with ${r.practitionerName} on ${when}.\n${this.whereLine(b)}`,
      link: `${origin}/portal`,
      actionLabel: 'View my booking',
      tenantId: b.tenantId,
      profileId: b.clientProfileId,
    });
  }

  /** The client's one email for several confirmed sessions, each with its own link. */
  private async emailClientSeveral(sessions: Array<{ r: StaffBookingResult; b: any }>): Promise<void> {
    const first = sessions[0].b;
    const timeZone = first.client.timezone || 'Africa/Lagos';
    const lines = sessions.map(({ b, r }) => `• ${this.when(r.startsAt, timeZone)}\n  ${this.whereLine(b)}`).join('\n');
    const r = sessions[0].r;
    await this.notifications.sendEmail({
      to: first.client.email,
      type: 'bookings.staff_confirmed',
      title: `Your ${sessions.length} sessions are booked`,
      message: `${first.tenant.name} has booked ${sessions.length} sessions of ${r.serviceTitle} with ${r.practitionerName}:\n${lines}`,
      link: `${tenantWebOrigin(first.tenant)}/portal`,
      actionLabel: 'View my bookings',
      tenantId: first.tenantId,
      profileId: first.clientProfileId,
    });
  }

  /** The practitioner's copy: who, when, how to join, and whether it is paid. */
  private async emailPractitioner(sessions: Array<{ r: StaffBookingResult; b: any }>): Promise<void> {
    const first = sessions[0].b;
    const practitioner = first.availability?.therapist?.profile;
    if (!practitioner?.email) return;
    const timeZone = practitioner.timezone || 'Africa/Lagos';
    const client = sessions[0].r.clientName;
    const paid = (r: StaffBookingResult) =>
      r.status === 'PENDING_PAYMENT' ? 'waiting for payment' : r.paymentMethod === 'NONE' ? 'no charge' : r.paymentMethod === 'MANUAL' ? 'marked as paid' : 'paid';
    const lines = sessions.map(({ b, r }) => `• ${this.when(r.startsAt, timeZone)} (${paid(r)})\n  ${this.whereLine(b)}`).join('\n');
    const n = sessions.length;
    await this.notifications.sendEmail({
      to: practitioner.email,
      type: 'bookings.staff_booked_copy',
      title: n > 1 ? `${n} sessions booked with ${client}` : `Session booked with ${client}`,
      message: `${n > 1 ? `${n} sessions` : 'A session'} of ${sessions[0].r.serviceTitle} with ${client}:\n${lines}`,
      link: `${tenantWebOrigin(first.tenant)}/dashboard/sessions/${first.id}`,
      actionLabel: n > 1 ? 'View the first session' : 'View the session',
      tenantId: first.tenantId,
      profileId: practitioner.id,
    });
  }

  private async payLinkBooking(tenantId: bigint, bookingId: bigint, token: string) {
    // The token is checked before any lookup, so a guess learns nothing.
    if (!payLinkTokenValid(bookingId, token)) throw new NotFoundException('This payment link is not valid.');
    const b = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId },
      include: {
        service: true,
        client: { select: { email: true } },
        tenant: { select: { name: true, slug: true, customDomain: true, customDomainStatus: true } },
        availability: { include: { therapist: { include: { profile: true } } } },
      },
    });
    if (!b) throw new NotFoundException('This payment link is not valid.');
    return b;
  }

  async payLinkSummary(tenantId: bigint, bookingId: bigint, token: string) {
    const b: any = await this.payLinkBooking(tenantId, bookingId, token);
    const state = b.status === 'PENDING_PAYMENT' ? 'PAYABLE' : b.status === 'CANCELLED' ? 'LAPSED' : 'PAID';
    return {
      state: state as 'PAYABLE' | 'PAID' | 'LAPSED',
      serviceTitle: b.service.title,
      practitionerName: fullName(b.availability.therapist?.profile),
      startsAt: b.availability.startsAt.toISOString(),
      amountKobo: chargedKobo(b).toString(),
      practiceName: b.tenant.name,
      // BKG-09: how long the time is held, and whether a hold that ran out can be paid again.
      holdExpiresAt: b.holdExpiresAt ? b.holdExpiresAt.toISOString() : null,
      canRetry: this.canRetry(b),
    };
  }

  async payLinkCheckout(tenantId: bigint, bookingId: bigint, token: string) {
    const b: any = await this.payLinkBooking(tenantId, bookingId, token);
    if (b.status !== 'PENDING_PAYMENT' && !this.canRetry(b)) {
      throw new BadRequestException(
        b.status === 'CANCELLED' ? 'This booking is no longer held. Contact the practice to book again.' : 'This session is already paid.',
      );
    }
    // BKG-09: the same restart as the booking page: a fresh hold, or the
    // released time re-claimed if it's still free.
    const { paymentUrl } = await this.consult.restartOnlinePayment(tenantId, bookingId, {});
    return { paymentUrl };
  }

  /** A hold the expiry job let go (not a cancellation) can be paid again while the session is still ahead. */
  private canRetry(b: { status: string; holdReleasedAt?: Date | null; availability: { startsAt: Date } }) {
    return b.status === 'CANCELLED' && !!b.holdReleasedAt && b.availability.startsAt > new Date();
  }


  /** Where the session sits: an open slot, or (Task 7) a time staff choose. */
  protected async resolveTime(
    tenantId: bigint,
    providerId: bigint,
    service: { id: bigint; durationMinutes: number },
    dto: StaffBookingInput,
  ): Promise<StaffBookingTime> {
    if (dto.availabilityId) {
      const slot = await this.prisma.consultAvailability.findFirst({
        where: { id: id(dto.availabilityId, 'a time'), tenantId, providerProfileId: providerId, isActive: true },
      });
      if (!slot) throw new BadRequestException('That time is no longer open. Choose another.');
      if (slot.serviceId !== null && slot.serviceId !== service.id) {
        throw new BadRequestException('That time is kept for a different service. Choose another.');
      }
      if (service.durationMinutes > (slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000) {
        throw new BadRequestException('That time is too short for this service. Choose another.');
      }
      return { kind: 'slot', slotId: slot.id, startsAt: slot.startsAt, endsAt: slot.endsAt, allowsOnline: slot.allowsOnline, allowsInPerson: slot.allowsInPerson, locationId: slot.locationId };
    }
    if (dto.startsAt) {
      const startsAt = new Date(String(dto.startsAt));
      if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Enter a valid time.');
      if (startsAt.getTime() <= Date.now()) throw new BadRequestException('Choose a time in the future.');
      return { kind: 'custom', startsAt, endsAt: new Date(startsAt.getTime() + service.durationMinutes * 60_000) };
    }
    throw new BadRequestException('Choose a time.');
  }

  /** Takes the time inside the transaction. Returns the availability id to book against. */
  protected async claimTime(
    tx: any,
    tenantId: bigint,
    providerId: bigint,
    serviceId: bigint,
    time: Awaited<ReturnType<StaffBookingService['resolveTime']>>,
    practitionerName: string,
    timeZone: string,
  ): Promise<bigint> {
    if (time.kind === 'slot') {
      const claimed = await tx.consultAvailability.updateMany({
        where: { id: time.slotId, tenantId, isActive: true },
        data: { isActive: false },
      });
      if (claimed.count === 0) throw new BadRequestException('That time is no longer open. Choose another.');
      return time.slotId;
    }

    // One custom booking at a time per practitioner, for this transaction.
    const lockKey = `staff-booking:${tenantId}:${providerId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

    // Close overlapping open slots FIRST. This update waits on any public
    // booking mid-claim of one of them, so the clash check below, which runs
    // after it, sees that booking once it commits.
    await tx.consultAvailability.updateMany({
      where: { tenantId, providerProfileId: providerId, isActive: true, startsAt: { lt: time.endsAt }, endsAt: { gt: time.startsAt } },
      data: { isActive: false },
    });

    const clash = await tx.consultBooking.findFirst({
      where: {
        tenantId,
        status: { not: 'CANCELLED' },
        availability: { providerProfileId: providerId, startsAt: { lt: time.endsAt }, endsAt: { gt: time.startsAt } },
      },
      include: { availability: true },
    });
    if (clash) {
      // In the practitioner's own time zone: UTC read as local was an hour out in Lagos.
      const hhmm = (d: Date) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone }).format(d);
      throw new BadRequestException(
        `${practitionerName || 'This practitioner'} already has a session from ${hhmm(clash.availability.startsAt)} to ${hhmm(clash.availability.endsAt)}. Choose another time.`,
      );
    }

    const slot = await tx.consultAvailability.create({
      data: { tenantId, providerProfileId: providerId, serviceId, startsAt: time.startsAt, endsAt: time.endsAt, channel: 'VIDEO', isActive: false, createdForBooking: true },
    });
    return slot.id;
  }
}
