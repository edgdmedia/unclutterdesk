import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantWebOrigin } from '../../common/origins';
import { chargedKobo } from '../../common/revenue';
import { NotificationService } from '../notifications/notification.service';
import { CalendarService } from '../calendar/calendar.service';
import { formatNaira } from '../billing/subscription-plans';
import { FRONT_DESK } from '../../common/roles';

/** How long a bank-transfer booking holds its slot. */
export const MANUAL_HOLD_HOURS = 48;


export interface ManualPaymentDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  instructions?: string | null;
}

const PAID_PLANS = ['PRO', 'CLINIC'];

/** The reference a client puts on their transfer, so staff can match it. */
export const transferReference = (bookingId: bigint) => `UD-${bookingId.toString()}`;

/**
 * When a bank-transfer hold ends: 48 hours from booking, but never after the
 * session starts. An unpaid session cannot keep its slot past its own start.
 */
export function holdExpiry(now: Date, startsAt: Date): Date {
  const hold = new Date(now.getTime() + MANUAL_HOLD_HOURS * 60 * 60 * 1000);
  return hold < startsAt ? hold : startsAt;
}

function cleanDetails(raw: unknown): ManualPaymentDetails | null {
  const d = (raw ?? {}) as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const details = {
    bankName: text(d.bankName, 80),
    accountName: text(d.accountName, 120),
    accountNumber: text(d.accountNumber, 20).replace(/\s+/g, ''),
    instructions: text(d.instructions, 500) || null,
  };
  return details.bankName || details.accountName || details.accountNumber ? details : null;
}

/**
 * Bank transfers paid straight to the practice. Platform fees on Pro and
 * Clinic are 0%, so offering this does not bypass a fee; that is also why it
 * is not offered on Starter, whose bookings carry the platform's share.
 */
@Injectable()
export class ManualPaymentService {
  private readonly logger = new Logger(ManualPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly calendar: CalendarService,
  ) {}

  // ── Practice settings ──

  async getSettings(tenantId: bigint) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { manualPaymentsEnabled: true, manualPaymentDetails: true, subscriptionTier: true },
    });
    if (!t) throw new NotFoundException('Practice not found');
    return {
      enabled: t.manualPaymentsEnabled,
      details: cleanDetails(t.manualPaymentDetails),
      onPlan: PAID_PLANS.includes((t.subscriptionTier || 'STARTER').toUpperCase()),
      holdHours: MANUAL_HOLD_HOURS,
    };
  }

  async updateSettings(tenantId: bigint, dto: { enabled?: boolean; details?: unknown }) {
    const current = await this.getSettings(tenantId);
    const enabled = dto.enabled ?? current.enabled;
    const details = dto.details !== undefined ? cleanDetails(dto.details) : current.details;
    if (enabled) {
      if (!current.onPlan) {
        throw new ForbiddenException('Bank transfer payments are part of the Pro and Clinic plans.');
      }
      if (!details?.bankName || !details.accountName || !/^\d{10}$/.test(details.accountNumber)) {
        throw new BadRequestException('Add the bank name, account name and a 10-digit account number before turning this on.');
      }
    }
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        manualPaymentsEnabled: enabled,
        manualPaymentDetails: details ? (details as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });
    return this.getSettings(tenantId);
  }

  /** The bank details, if this practice can take a transfer right now. */
  async available(tenantId: bigint): Promise<ManualPaymentDetails | null> {
    const s = await this.getSettings(tenantId);
    return s.enabled && s.onPlan && s.details ? s.details : null;
  }

  // ── Around a booking ──

  /** Tells the client how to pay, and the practice that a transfer is on its way. */
  async announce(bookingId: bigint) {
    const b = await this.loadBooking(bookingId);
    if (!b) return;
    const details = cleanDetails(b.tenant.manualPaymentDetails);
    if (!details) return;
    const amount = formatNaira(Number(chargedKobo(b)));
    const when = this.sessionTime(b.availability.startsAt);
    const deadline = this.sessionTime(b.holdExpiresAt ?? b.availability.startsAt);
    try {
      await this.notifications.sendEmail({
        to: b.client.email,
        type: 'bookings.manual_payment_due',
        title: `Pay ${amount} by bank transfer to confirm your session`,
        message:
          `Your ${b.service.title} on ${when} is held for you until ${deadline}.\n\n` +
          `Bank: ${details.bankName}\nAccount name: ${details.accountName}\nAccount number: ${details.accountNumber}\n` +
          `Amount: ${amount}\nReference: ${transferReference(b.id)}\n\n` +
          `${details.instructions ? `${details.instructions}\n\n` : ''}` +
          `${b.tenant.name} will confirm your session when the transfer arrives. If it has not arrived by then, the time is released.`,
        link: `${tenantWebOrigin(b.tenant)}/portal`,
        actionLabel: 'View my booking',
        tenantId: b.tenantId,
        profileId: b.clientProfileId,
      });
    } catch (err) {
      this.logger.warn(`Could not email transfer details for booking ${b.id}: ${(err as Error).message}`);
    }
    await this.tellConfirmers(b, `New booking awaiting a bank transfer`, `${this.clientName(b)} booked ${b.service.title} on ${when} and will pay ${amount} by transfer (reference ${transferReference(b.id)}).`);
  }

  /** Bookings waiting on a transfer, soonest hold first. */
  async pending(tenantId: bigint) {
    const rows = await this.prisma.consultBooking.findMany({
      where: { tenantId, paymentMethod: 'MANUAL', status: 'PENDING_PAYMENT' },
      include: {
        service: { select: { title: true, priceKobo: true } },
        availability: { select: { startsAt: true } },
        client: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { holdExpiresAt: 'asc' },
    });
    return rows.map((b) => ({
      id: b.id.toString(),
      reference: transferReference(b.id),
      amountKobo: chargedKobo(b).toString(),
      serviceTitle: b.service.title,
      startsAt: b.availability.startsAt.toISOString(),
      holdExpiresAt: b.holdExpiresAt?.toISOString() ?? null,
      clientReportedPaidAt: b.clientReportedPaidAt?.toISOString() ?? null,
      client: { name: [b.client.firstName, b.client.lastName].filter(Boolean).join(' ') || b.client.email, email: b.client.email },
    }));
  }

  /** Staff confirm the money arrived. The client is emailed and the session is confirmed. */
  async markPaid(tenantId: bigint, actorProfileId: bigint, bookingId: bigint) {
    // Conditional, so it cannot race the hold expiring or a second click.
    const updated = await this.prisma.consultBooking.updateMany({
      where: { id: bookingId, tenantId, paymentMethod: 'MANUAL', status: 'PENDING_PAYMENT' },
      data: { status: 'CONFIRMED', paidAt: new Date(), paymentConfirmedByProfileId: actorProfileId },
    });
    if (updated.count === 0) {
      throw new BadRequestException('This booking is not waiting for a transfer. It may already be confirmed, or its hold ran out.');
    }
    const b = await this.loadBooking(bookingId);
    if (b) {
      try {
        await this.notifications.sendEmail({
          to: b.client.email,
          type: 'bookings.manual_payment_received',
          title: 'Payment received: your session is confirmed',
          message: `${b.tenant.name} has received your transfer. Your ${b.service.title} on ${this.sessionTime(b.availability.startsAt)} is confirmed.`,
          link: `${tenantWebOrigin(b.tenant)}/portal`,
          actionLabel: 'View my booking',
          tenantId: b.tenantId,
          profileId: b.clientProfileId,
        });
      } catch (err) {
        this.logger.warn(`Could not email payment confirmation for booking ${b.id}: ${(err as Error).message}`);
      }
      await this.calendar.pushBookingToGoogle(bookingId).catch(() => undefined);
    }
    return { id: bookingId.toString(), status: 'CONFIRMED' };
  }

  /** The client says they have sent it. Staff are told to check. */
  async clientReportsPaid(tenantId: bigint, bookingId: bigint, email: string) {
    const updated = await this.prisma.consultBooking.updateMany({
      where: {
        id: bookingId,
        tenantId,
        paymentMethod: 'MANUAL',
        status: 'PENDING_PAYMENT',
        client: { email: String(email ?? '').toLowerCase().trim() },
      },
      data: { clientReportedPaidAt: new Date() },
    });
    if (updated.count === 0) throw new NotFoundException('No booking waiting for a transfer was found.');
    const b = await this.loadBooking(bookingId);
    if (b) {
      await this.tellConfirmers(b, `${this.clientName(b)} says they have paid`, `Check for a transfer of ${formatNaira(Number(chargedKobo(b)))} with reference ${transferReference(b.id)}, then mark it paid.`);
    }
    return { ok: true };
  }

  /** A hold ran out: the client is told the time was released. */
  async released(bookingId: bigint) {
    const b = await this.loadBooking(bookingId);
    if (!b) return;
    try {
      await this.notifications.sendEmail({
        to: b.client.email,
        type: 'bookings.manual_payment_expired',
        title: 'Your held session was released',
        message: `We did not receive a transfer for your ${b.service.title} on ${this.sessionTime(b.availability.startsAt)}, so the time has been released. You are welcome to book again.`,
        link: `${tenantWebOrigin(b.tenant)}/book`,
        actionLabel: 'Book again',
        tenantId: b.tenantId,
        profileId: b.clientProfileId,
      });
    } catch (err) {
      this.logger.warn(`Could not email hold release for booking ${b.id}: ${(err as Error).message}`);
    }
  }

  // ── Helpers ──

  private loadBooking(id: bigint) {
    return this.prisma.consultBooking.findUnique({
      where: { id },
      include: {
        tenant: { select: { name: true, slug: true, customDomain: true, customDomainStatus: true, manualPaymentDetails: true } },
        service: { select: { title: true, priceKobo: true } },
        availability: { select: { startsAt: true } },
        client: { select: { firstName: true, lastName: true, email: true } },
      },
    });
  }

  private clientName(b: { client: { firstName: string | null; lastName: string | null; email: string } }) {
    return [b.client.firstName, b.client.lastName].filter(Boolean).join(' ') || b.client.email;
  }

  private sessionTime(d: Date) {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos',
    }).format(d);
  }

  private async tellConfirmers(b: { tenantId: bigint }, title: string, message: string) {
    try {
      const staff = await this.prisma.profile.findMany({
        where: { tenantId: b.tenantId, role: { in: FRONT_DESK }, status: 'active' },
        select: { id: true },
      });
      if (!staff.length) return;
      await this.notifications.notify({
        tenantId: b.tenantId,
        profileIds: staff.map((s) => s.id),
        type: 'bookings.manual_payment',
        title,
        message,
        link: '/dashboard',
        actionLabel: 'Review payments',
      });
    } catch (err) {
      this.logger.warn(`Could not notify staff about a transfer: ${(err as Error).message}`);
    }
  }
}
