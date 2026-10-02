import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { isMeetLink, roomResetOnMove, staffRoomPath } from '../video/room-links';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { BookingNotifier } from '../notifications/booking-notifier.service';
import { chargedKobo } from '../../common/revenue';
import { tenantWebOrigin } from '../../common/origins';

export interface SessionActor {
  profileId: bigint;
  viewAll: boolean;
  clinical?: boolean;
  desk?: boolean;
}

const name = (p: { firstName?: string | null; lastName?: string | null } | null | undefined, fallback = 'Client') =>
  `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || fallback;


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
      service: { select: { title: true } },
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

  /** Staff move a session to another open slot of the same practitioner. */
  async rescheduleByStaff(tenantId: bigint, actor: SessionActor, bookingId: bigint, newAvailabilityId: bigint) {
    if (!actor.viewAll) {
      throw new ForbiddenException('Ask the front desk or a practice admin to move a session.');
    }
    return this.prisma.$transaction(async (tx: any) => {
      const b = await tx.consultBooking.findFirst({
        where: { id: bookingId, tenantId },
        select: { id: true, status: true, availabilityId: true, serviceId: true, format: true, videoProvider: true },
      });
      if (!b) throw new NotFoundException('Session not found');
      if (b.status === 'CANCELLED' || b.status === 'COMPLETED') {
        throw new BadRequestException('A cancelled or completed session cannot be moved.');
      }
      const [slot, oldSlot] = await Promise.all([
        tx.consultAvailability.findFirst({ where: { id: newAvailabilityId, tenantId } }),
        tx.consultAvailability.findFirst({ where: { id: b.availabilityId }, select: { providerProfileId: true } }),
      ]);
      if (!slot || !slot.isActive || slot.startsAt <= new Date()) {
        throw new BadRequestException('That time is no longer open. Choose another.');
      }
      if (slot.providerProfileId !== oldSlot?.providerProfileId) {
        throw new BadRequestException('Pick an open time from the same practitioner.');
      }
      if (slot.serviceId !== null && slot.serviceId !== b.serviceId) {
        throw new BadRequestException('That time is kept for a different service. Choose another.');
      }
      // SET-06: a move keeps the bought format; the place comes with the time.
      if (b.format === 'IN_PERSON' && (!slot.allowsInPerson || !slot.locationId)) {
        throw new BadRequestException("That time isn't available in person. Choose another.");
      }
      if ((b.format ?? 'ONLINE') === 'ONLINE' && slot.allowsOnline === false) {
        throw new BadRequestException("That time isn't available online. Choose another.");
      }
      await tx.consultAvailability.updateMany({ where: { id: b.availabilityId, tenantId }, data: { isActive: true } });
      await tx.consultAvailability.update({ where: { id: slot.id }, data: { isActive: false } });
      await tx.consultBooking.update({
        where: { id: b.id },
        data: { availabilityId: slot.id, ...(b.format === 'IN_PERSON' ? { locationId: slot.locationId } : {}), ...roomResetOnMove(b) },
      });
      return { id: b.id.toString(), startsAt: slot.startsAt.toISOString() };
    });
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
