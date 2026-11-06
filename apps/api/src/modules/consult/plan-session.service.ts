import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { chargedKobo } from '../../common/revenue';
import { tenantWebOrigin } from '../../common/origins';
import { assertWithinMonthlyLimit } from './booking-limits';
import { StaffBookingService, type StaffBookingResult } from './staff-booking.service';
import type { SessionActor } from './session-directory.service';

const fullName = (p: { firstName?: string | null; lastName?: string | null } | null | undefined) =>
  `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim();

/**
 * Not-yet-scheduled sessions (spec §11.2, first piece).
 *
 * A booked session can be turned into "not scheduled": its time goes back to
 * the pool and the client chooses a new one in the portal, or staff choose it
 * for them. A chosen time is booked straight away, with no payment step.
 *
 * Money stays on the booking it was paid on. Unscheduling cancels that
 * booking (it is never rewritten, so revenue, refunds and the client's
 * payments keep reading it), and the plan session points back at it. The
 * booking made when a time is chosen carries no second charge (PLAN).
 *
 * Scheduling is a staff booking underneath: the same claim, clash rules,
 * monthly limit (counted when scheduled, not when paid), emails and calendar
 * invite, so the two cannot drift.
 */
@Injectable()
export class PlanSessionService extends StaffBookingService {
  /** A therapist sees their own clients; the desk, everyone's. */
  private scope(actor: SessionActor) {
    return actor.viewAll ? {} : { providerProfileId: actor.profileId };
  }

  async unschedule(tenantId: bigint, actor: SessionActor, bookingId: bigint) {
    const b: any = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId, ...(actor.viewAll ? {} : { availability: { providerProfileId: actor.profileId } }) },
      include: { availability: true, service: true, planSession: { select: { id: true } } },
    });
    if (!b) throw new NotFoundException('Session not found');
    if (b.status === 'PENDING_PAYMENT') {
      throw new BadRequestException('This session is not paid yet. Cancel it instead, or wait for the payment.');
    }
    if (b.status !== 'CONFIRMED') throw new BadRequestException('Only a booked session can be left for the client to schedule.');

    const now = new Date();
    const planSessionId = await this.prisma.$transaction(async (tx: any) => {
      // The status is part of the match: two clicks unschedule it once.
      const cancelled = await tx.consultBooking.updateMany({
        where: { id: b.id, tenantId, status: 'CONFIRMED' },
        data: { status: 'CANCELLED', unscheduledAt: now },
      });
      if (cancelled.count === 0) throw new BadRequestException('This session has already changed. Reload the page.');
      await tx.consultAvailability.updateMany({ where: { id: b.availabilityId, tenantId, createdForBooking: false }, data: { isActive: true } });

      // Already a plan session: it simply has no time again.
      if (b.planSession) {
        await tx.planSession.updateMany({ where: { id: b.planSession.id, tenantId, bookingId: b.id }, data: { status: 'PAID', bookingId: null } });
        return b.planSession.id as bigint;
      }

      const providerProfileId = b.availability.providerProfileId;
      const plan =
        (await tx.sessionPlan.findFirst({ where: { tenantId, clientProfileId: b.clientProfileId, providerProfileId, status: 'ACTIVE' }, select: { id: true } })) ??
        (await tx.sessionPlan.create({ data: { tenantId, clientProfileId: b.clientProfileId, providerProfileId, status: 'ACTIVE', createdByProfileId: actor.profileId } }));
      const existingLine = await tx.sessionPlanLine.findFirst({ where: { planId: plan.id, serviceId: b.serviceId }, select: { id: true, count: true } });
      const line = existingLine
        ? await tx.sessionPlanLine.update({ where: { id: existingLine.id }, data: { count: existingLine.count + 1 } })
        : await tx.sessionPlanLine.create({ data: { planId: plan.id, serviceId: b.serviceId, count: 1, unitPriceKobo: chargedKobo(b) } });
      const ps = await tx.planSession.create({
        data: {
          tenantId,
          planId: plan.id,
          lineId: existingLine ? existingLine.id : line.id,
          clientProfileId: b.clientProfileId,
          providerProfileId,
          serviceId: b.serviceId,
          format: b.format ?? 'ONLINE',
          locationId: b.format === 'IN_PERSON' ? b.locationId : null,
          status: 'PAID',
          paymentMethod: b.paymentMethod,
          amountKobo: chargedKobo(b),
          paidAt: b.paidAt,
          paidOnBookingId: b.id,
          bookingId: null,
          createdByProfileId: actor.profileId,
        },
      });
      return ps.id as bigint;
    });

    await this.emailUnscheduled(tenantId, b).catch((err) =>
      this.logger.warn(`Could not email the client about unscheduled booking ${b.id}: ${(err as Error).message}`),
    );
    return { planSessionId: planSessionId.toString() };
  }

  private async emailUnscheduled(tenantId: bigint, b: any) {
    const client = await this.prisma.profile.findFirst({ where: { id: b.clientProfileId, tenantId }, select: { id: true, email: true, timezone: true } });
    if (!client?.email) return;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const when = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: client.timezone || 'Africa/Lagos',
    }).format(b.availability.startsAt);
    await this.notifications.sendEmail({
      to: client.email,
      type: 'bookings.unscheduled',
      title: 'Choose a time for your session',
      message: `${tenant?.name ?? 'Your practice'} has freed your ${b.service.title} session on ${when}, so you can choose a time that suits you. It is already paid for.`,
      link: `${tenantWebOrigin(tenant as any)}/portal`,
      actionLabel: 'Choose a time',
      tenantId,
      profileId: client.id,
    });
  }

  /** A client's sessions with no time yet, oldest first. */
  async listForClient(tenantId: bigint, clientProfileId: bigint, actor?: SessionActor) {
    const rows: any[] = await this.prisma.planSession.findMany({
      where: { tenantId, clientProfileId, status: 'PAID', bookingId: null, ...(actor ? this.scope(actor) : {}) },
      orderBy: { createdAt: 'asc' },
    });
    if (!rows.length) return [];
    const [services, therapists] = await Promise.all([
      this.prisma.consultService.findMany({ where: { tenantId, id: { in: [...new Set(rows.map((r) => r.serviceId))] } }, select: { id: true, title: true, durationMinutes: true } }),
      this.prisma.profile.findMany({ where: { tenantId, id: { in: [...new Set(rows.map((r) => r.providerProfileId))] } }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    const service = new Map(services.map((s: any) => [s.id.toString(), s]));
    const therapist = new Map(therapists.map((t: any) => [t.id.toString(), t]));
    return rows.map((r) => {
      const s: any = service.get(r.serviceId.toString());
      return {
        id: r.id.toString(),
        serviceId: r.serviceId.toString(),
        serviceTitle: s?.title ?? 'Session',
        durationMinutes: s?.durationMinutes ?? null,
        provider: { id: r.providerProfileId.toString(), name: fullName(therapist.get(r.providerProfileId.toString()) as any) || 'Practitioner' },
        format: r.format,
        paymentMethod: r.paymentMethod,
        amountKobo: r.amountKobo.toString(),
        paidAt: r.paidAt ? r.paidAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  private async loadOpen(tenantId: bigint, planSessionId: bigint, who: { clientProfileId: bigint } | { actor: SessionActor }) {
    const ps: any = await this.prisma.planSession.findFirst({
      where: {
        id: planSessionId,
        tenantId,
        status: 'PAID',
        bookingId: null,
        ...('clientProfileId' in who ? { clientProfileId: who.clientProfileId } : this.scope(who.actor)),
      },
    });
    if (!ps) throw new NotFoundException('That session is not waiting for a time.');
    return ps;
  }

  /** The times a client may choose: exactly what the booking page offers. */
  async optionsForClient(tenantId: bigint, clientProfileId: bigint, planSessionId: bigint) {
    const ps = await this.loadOpen(tenantId, planSessionId, { clientProfileId });
    return this.consult.getPublicAvailability(tenantId, ps.providerProfileId, ps.serviceId, ps.format);
  }

  async scheduleByClient(tenantId: bigint, clientProfileId: bigint, planSessionId: bigint, availabilityId: bigint) {
    const ps = await this.loadOpen(tenantId, planSessionId, { clientProfileId });
    const open = await this.consult.getPublicAvailability(tenantId, ps.providerProfileId, ps.serviceId, ps.format);
    if (!open.some((s: { id: string }) => s.id === availabilityId.toString())) {
      throw new BadRequestException('That time is no longer open. Choose another.');
    }
    return this.book(tenantId, ps, { availabilityId: availabilityId.toString() }, null);
  }

  async scheduleByStaff(tenantId: bigint, actor: SessionActor, planSessionId: bigint, time: { availabilityId?: bigint; startsAt?: Date }) {
    const ps = await this.loadOpen(tenantId, planSessionId, { actor });
    return this.book(
      tenantId,
      ps,
      time.availabilityId ? { availabilityId: time.availabilityId.toString() } : { startsAt: time.startsAt?.toISOString() },
      actor.profileId,
    );
  }

  /** §5.5, when the session is scheduled rather than when it was paid. */
  protected async withinMonthlyLimit(tenantId: bigint, startsAt: Date) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    await assertWithinMonthlyLimit(this.prisma as any, tenantId, tenant as any, { sessionStartsAt: startsAt, adding: 1 });
  }

  private async book(tenantId: bigint, ps: any, at: { availabilityId?: string; startsAt?: string }, actorProfileId: bigint | null) {
    const service = await this.prisma.consultService.findFirst({ where: { id: ps.serviceId, tenantId }, select: { id: true, title: true, durationMinutes: true } });
    if (!service) throw new BadRequestException('That service is no longer offered. Ask the practice to choose a time.');
    const time = await this.resolveTime(tenantId, ps.providerProfileId, service, at as any);
    await this.consult.assertNotAway(tenantId, ps.providerProfileId, time.startsAt);

    // SET-06: the paid-for format is kept; an open time must offer it.
    const inPerson = ps.format === 'IN_PERSON';
    let locationId: bigint | null = inPerson ? ps.locationId : null;
    if (time.kind === 'slot') {
      if (inPerson && (!time.allowsInPerson || !time.locationId)) throw new BadRequestException("That time isn't available in person. Choose another.");
      if (!inPerson && time.allowsOnline === false) throw new BadRequestException("That time isn't available online. Choose another.");
      if (inPerson) locationId = time.locationId ?? null;
    }
    await this.withinMonthlyLimit(tenantId, time.startsAt);

    const therapist: any = await this.prisma.consultTherapistProfile.findFirst({
      where: { profileId: ps.providerProfileId, tenantId },
      include: { profile: true },
    });
    const booking = await this.prisma.$transaction(async (tx: any) => {
      const claimed = await tx.planSession.updateMany({
        where: { id: ps.id, tenantId, status: 'PAID', bookingId: null },
        data: { status: 'SCHEDULED' },
      });
      if (claimed.count === 0) throw new BadRequestException('This session already has a time.');
      const slotId = await this.claimTime(tx, tenantId, ps.providerProfileId, ps.serviceId, time, fullName(therapist?.profile), therapist?.profile?.timezone || 'Africa/Lagos');
      const made = await tx.consultBooking.create({
        data: {
          tenantId,
          serviceId: ps.serviceId,
          availabilityId: slotId,
          clientProfileId: ps.clientProfileId,
          createdByProfileId: actorProfileId,
          format: ps.format,
          locationId,
          status: 'CONFIRMED',
          // Paid already, on the booking the plan session records.
          paymentMethod: 'PLAN',
          amountKobo: 0n,
        },
      });
      await tx.planSession.update({ where: { id: ps.id }, data: { bookingId: made.id } });
      return made;
    });

    const client: any = await this.prisma.profile.findFirst({ where: { id: ps.clientProfileId, tenantId }, select: { firstName: true, lastName: true, email: true } });
    const result: StaffBookingResult = {
      bookingId: booking.id.toString(),
      status: 'CONFIRMED',
      paymentMethod: 'PLAN',
      amountKobo: '0',
      startsAt: time.startsAt.toISOString(),
      endsAt: time.endsAt.toISOString(),
      holdExpiresAt: null,
      serviceTitle: service.title,
      practitionerName: fullName(therapist?.profile),
      clientName: fullName(client) || client?.email || 'Client',
      format: ps.format,
      location: locationId ? { id: locationId.toString() } : null,
    };
    await this.afterBooking([result], true).catch((err) =>
      this.logger.warn(`After-booking steps failed for plan session ${ps.id}: ${(err as Error).message}`),
    );
    return result;
  }
}
