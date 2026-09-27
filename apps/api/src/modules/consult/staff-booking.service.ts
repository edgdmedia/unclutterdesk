import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { CalendarService } from '../calendar/calendar.service';
import { ConsultService } from './consult.service';
import { assertWithinMonthlyLimit } from './booking-limits';
import { paidAmount, parseStaffPayment, paymentsAllowed, payLinkToken, payLinkTokenValid, staffLinkHold } from './staff-booking-rules';
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
}

const id = (v: unknown, what: string): bigint => {
  if (!/^\d+$/.test(String(v ?? ''))) throw new BadRequestException(`Choose ${what}.`);
  return BigInt(String(v));
};
const fullName = (p: { firstName?: string | null; lastName?: string | null } | null | undefined) =>
  `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim();

type StaffBookingTime =
  | { kind: 'slot'; slotId: bigint; startsAt: Date; endsAt: Date }
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
      include: { profile: true },
    });
    if (!therapist) throw new BadRequestException('Choose a practitioner in this practice.');

    const service = await this.prisma.consultService.findFirst({ where: { id: serviceId, tenantId, isActive: true } });
    if (!service) throw new BadRequestException('That service is not offered. Choose another service.');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    await assertWithinMonthlyLimit(this.prisma, tenantId, tenant?.subscriptionTier);

    const time = await this.resolveTime(tenantId, providerId, service, dto);

    const price = BigInt(service.priceKobo ?? 0);
    const now = new Date();
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

    const booking = await this.prisma.$transaction(async (tx) => {
      const slotId = await this.claimTime(tx, tenantId, providerId, service.id, time, fullName(therapist.profile));
      const { roomName } = await this.consult.resolveVideoRoomLink(therapist, Date.now());
      return tx.consultBooking.create({
        data: {
          tenantId,
          serviceId: service.id,
          availabilityId: slotId,
          clientProfileId: client.id,
          createdByProfileId: actorProfileId,
          notes: dto.note ? String(dto.note).trim().slice(0, 1000) || null : null,
          videoRoomName: roomName,
          ...paymentData,
        } as any,
      });
    });

    const result: StaffBookingResult = {
      bookingId: booking.id.toString(),
      status: paymentData.status as StaffBookingResult['status'],
      paymentMethod: paymentData.paymentMethod as StaffBookingResult['paymentMethod'],
      amountKobo: paymentData.amountKobo.toString(),
      startsAt: time.startsAt.toISOString(),
      endsAt: time.endsAt.toISOString(),
      holdExpiresAt: hold ? hold.toISOString() : null,
      serviceTitle: service.title,
      practitionerName: fullName(therapist.profile),
      clientName: fullName(client) || client.email,
    };
    // After commit, and never failing the booking.
    await this.afterCreate(booking.id, result, dto.notifyClient !== false).catch((err) =>
      this.logger.warn(`After-booking steps failed for ${booking.id}: ${(err as Error).message}`),
    );
    return result;
  }

  /** Emails and calendar sync, after the transaction commits. */
  protected async afterCreate(bookingId: bigint, r: StaffBookingResult, notifyClient: boolean): Promise<void> {
    const b = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId },
      include: { client: true, tenant: true },
    });
    if (!b) return;
    const origin = tenantWebOrigin(b.tenant as any);
    const when = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos',
    }).format(new Date(r.startsAt));

    if (r.status === 'CONFIRMED') {
      await this.calendar.pushBookingToGoogle(bookingId).catch(() => undefined);
    }
    if (!notifyClient) return;

    try {
      if (r.status === 'PENDING_PAYMENT') {
        const deadline = r.holdExpiresAt
          ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(new Date(r.holdExpiresAt))
          : '';
        await this.notifications.sendEmail({
          to: b.client.email,
          type: 'bookings.staff_payment_link',
          title: `Pay for your session on ${when}`,
          message: `${b.tenant.name} has booked your ${r.serviceTitle} with ${r.practitionerName} on ${when}. Please pay ${formatNaira(Number(r.amountKobo))} by ${deadline} to keep this time.`,
          link: `${origin}/pay/${bookingId}?t=${payLinkToken(bookingId)}`,
          actionLabel: 'Pay now',
          tenantId: b.tenantId,
          profileId: b.clientProfileId,
        });
      } else {
        await this.notifications.sendEmail({
          to: b.client.email,
          type: 'bookings.staff_confirmed',
          title: 'Your session is booked',
          message: `${b.tenant.name} has booked your ${r.serviceTitle} with ${r.practitionerName} on ${when}.`,
          link: `${origin}/portal`,
          actionLabel: 'View my booking',
          tenantId: b.tenantId,
          profileId: b.clientProfileId,
        });
      }
    } catch (err) {
      this.logger.warn(`Could not email the client about booking ${bookingId}: ${(err as Error).message}`);
    }
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
    };
  }

  async payLinkCheckout(tenantId: bigint, bookingId: bigint, token: string) {
    const b: any = await this.payLinkBooking(tenantId, bookingId, token);
    if (b.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(
        b.status === 'CANCELLED' ? 'This booking is no longer held. Contact the practice to book again.' : 'This session is already paid.',
      );
    }
    const reference = `booking-${b.id}-${Date.now()}`;
    const paymentUrl = await this.consult.startOnlinePayment(
      tenantId,
      chargedKobo(b),
      b.client.email,
      reference,
      `${tenantWebOrigin(b.tenant)}/booking/confirmed`,
    );
    // Only once Paystack accepted it, as getBookingPaymentUrl does.
    await this.prisma.consultBooking.update({ where: { id: b.id }, data: { paymentRef: reference } });
    return { paymentUrl };
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
      return { kind: 'slot', slotId: slot.id, startsAt: slot.startsAt, endsAt: slot.endsAt };
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
      const hhmm = (d: Date) => d.toISOString().slice(11, 16);
      throw new BadRequestException(
        `${practitionerName || 'This practitioner'} already has a session from ${hhmm(clash.availability.startsAt)} to ${hhmm(clash.availability.endsAt)} (UTC). Choose another time.`,
      );
    }

    const slot = await tx.consultAvailability.create({
      data: { tenantId, providerProfileId: providerId, serviceId, startsAt: time.startsAt, endsAt: time.endsAt, channel: 'VIDEO', isActive: false },
    });
    return slot.id;
  }
}
