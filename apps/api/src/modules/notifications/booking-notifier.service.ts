import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantWebOrigin } from '../../common/origins';
import { chargedKobo } from '../../common/revenue';
import { formatNaira } from '../billing/subscription-plans';
import { NotificationService } from './notification.service';
import { listPendingForms } from '../intake/default-forms';

/** Why a booking payment is being refunded (BKG-09). */
export type RefundReason = 'time_taken' | 'cancelled' | 'duplicate';

/** A room name may already be a full URL (a scheduled provider room). */
const roomLink = (roomName: string | null) =>
  roomName ? (roomName.startsWith('http') ? roomName : `https://meet.jit.si/${roomName}`) : null;

/**
 * Every message about a booking lives here, so the rules cannot drift apart:
 * the join link only travels once the session is confirmed, a transfer hold
 * hears its bank details from announce, and a free booking is confirmed the
 * moment it is made.
 */
@Injectable()
export class BookingNotifier {
  private readonly logger = new Logger(BookingNotifier.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  private load(bookingId: bigint) {
    return this.prisma.consultBooking.findUnique({
      where: { id: bookingId },
      include: {
        tenant: { select: { name: true, slug: true, customDomain: true, customDomainStatus: true } },
        service: { select: { title: true, priceKobo: true } },
        availability: { select: { startsAt: true, channel: true, providerProfileId: true } },
        client: { select: { firstName: true, lastName: true, email: true } },
      },
    });
  }

  private async therapistName(profileId: bigint): Promise<string> {
    const p = await this.prisma.profile.findUnique({ where: { id: profileId }, select: { firstName: true, lastName: true } });
    return [p?.firstName, p?.lastName].filter(Boolean).join(' ') || 'your therapist';
  }

  private when(startsAt: Date): string {
    return startsAt.toLocaleString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos',
    });
  }

  /**
   * A booking was made. The practice hears about it either way. Online and
   * awaiting payment: the pay email, no join link. A transfer hold: nothing to
   * the client — announce already sent the bank details. Confirmed at once
   * (free, waived, or staff-made): the confirmed email.
   */
  async booked(bookingId: bigint): Promise<void> {
    const b = await this.load(bookingId);
    if (!b) return;
    // Best effort: a failed staff notice must not cost the client their email.
    await this.notifyStaff(bookingId, 'booked').catch(() => undefined);
    if (b.status === 'CONFIRMED') return this.confirmedEmail(b);
    if (b.paymentMethod === 'MANUAL') return;
    const amount = formatNaira(Number(chargedKobo(b)));
    await this.notifications
      .sendEmail({
        to: b.client.email,
        type: 'bookings.payment_due',
        title: `Almost there — pay ${amount} to confirm your session`,
        message:
          `${b.tenant.name} has you down for ${b.service.title} with ${await this.therapistName(b.availability.providerProfileId)} ` +
          `on ${this.when(b.availability.startsAt)}. Your time is held while you pay.`,
        link: `${tenantWebOrigin(b.tenant)}/pay/${b.id}`,
        actionLabel: `Pay ${amount}`,
        tenantId: b.tenantId,
        profileId: b.clientProfileId,
      })
      .catch((err) => this.logger.warn(`Could not send the pay email for booking ${bookingId}: ${(err as Error).message}`));
  }

  /**
   * The session is paid or waived — the only moment the join link may travel.
   * Callers must invoke this exactly once (markBookingPaid says whether the
   * confirmation was new).
   */
  async confirmed(bookingId: bigint): Promise<void> {
    const b = await this.load(bookingId);
    if (!b) return;
    await this.confirmedEmail(b);
    // Money that actually moved is worth telling the practice about; a waived
    // fee was already announced as the booking itself.
    if (chargedKobo(b) > 0n) await this.notifyStaff(bookingId, 'paid').catch(() => undefined);
  }

  private async confirmedEmail(b: Awaited<ReturnType<BookingNotifier['load']>> & object): Promise<void> {
    const join = b.availability.channel === 'VIDEO' ? roomLink(b.videoRoomName) : null;
    const portal = `${tenantWebOrigin(b.tenant)}/portal`;
    // BKG-06: point the client at the forms they still owe, before the session.
    const pending = await this.pendingFormsFor(b.tenantId, b.clientProfileId).catch(() => []);
    const formsLine = pending.length
      ? `\n\nBefore your first session:\n${pending.map((f) => `${f.title} — ${tenantWebOrigin(b.tenant)}/forms/${f.id}?booking=${b.id} (${f.minutes} min)`).join('\n')}`
      : '';
    await this.notifications
      .sendEmail({
        to: b.client.email,
        type: 'bookings.confirmed',
        title: 'Your session is booked',
        message:
          `${b.tenant.name} has confirmed your ${b.service.title} with ${await this.therapistName(b.availability.providerProfileId)} ` +
          `on ${this.when(b.availability.startsAt)}.` +
          (join ? ` Join link: ${join}` : '') +
          ` Manage your booking any time — reschedule, cancel, pay or fill in your forms — at ${portal}.` + formsLine,
        link: join ?? portal,
        actionLabel: join ? 'Join the session' : 'View my bookings',
        tenantId: b.tenantId,
        profileId: b.clientProfileId,
      })
      .catch((err) => this.logger.warn(`Could not send the confirmation email for booking ${b.id}: ${(err as Error).message}`));
  }
  /** BKG-06: the default forms this client still needs, for the app's response. */
  pendingFormsFor(tenantId: bigint, clientProfileId: bigint) {
    return listPendingForms(this.prisma as any, tenantId, clientProfileId);
  }

/**
   * In-app notices for the practice: the session's therapist plus this
   * tenant's active owners and admins (the front desk too for transfers,
   * since they confirm them). Never anyone from another practice.
   */
  /**
   * BKG-09: a payment can't be used for its booking (it arrived after the time
   * was released and taken, the session was cancelled, or it was a second
   * payment), so Paystack is refunding it. The client and the practice hear why.
   */
  async latePaymentRefunded(bookingId: bigint, reason: RefundReason): Promise<void> {
    const b = await this.load(bookingId);
    if (!b) return;
    const amount = formatNaira(Number(chargedKobo(b)));
    const origin = tenantWebOrigin(b.tenant);
    const session = `${b.service.title} on ${this.when(b.availability.startsAt)}`;
    const why = {
      time_taken: `Your payment for ${session} arrived after the time was released, and someone else has since booked it.`,
      cancelled: `Your payment for ${session} arrived after the session was cancelled.`,
      duplicate: `Your session, ${session}, was already paid, so this second payment isn't needed.`,
    }[reason];
    await this.notifications
      .sendEmail({
        to: b.client.email,
        type: 'bookings.payment_refunded',
        title: `We're refunding your ${amount}`,
        message: `${why} Paystack is refunding ${amount} to you; it usually arrives within a few working days.`,
        link: reason === 'duplicate' ? `${origin}/portal` : `${origin}/book`,
        actionLabel: reason === 'duplicate' ? 'View my bookings' : 'Choose another time',
        tenantId: b.tenantId,
        profileId: b.clientProfileId,
      })
      .catch((err) => this.logger.warn(`Could not send the refund email for booking ${bookingId}: ${(err as Error).message}`));
    await this.notifyStaff(bookingId, 'refunded', reason).catch(() => undefined);
  }

  async notifyStaff(bookingId: bigint, event: 'booked' | 'paid' | 'transfer_sent' | 'cancelled' | 'refunded', reason: RefundReason = 'time_taken'): Promise<void> {
    const b = await this.load(bookingId);
    if (!b) return;
    const roles = event === 'transfer_sent' ? ['OWNER', 'ADMIN', 'RECEPTIONIST'] : ['OWNER', 'ADMIN'];
    const staff = await this.prisma.profile.findMany({
      where: { tenantId: b.tenantId, role: { in: roles }, status: 'active' },
      select: { id: true },
    });
    const profileIds = [...new Set([b.availability.providerProfileId, ...staff.map((s: { id: bigint }) => s.id)])].sort((a, c) => Number(a - c));
    const name = [b.client.firstName, b.client.lastName].filter(Boolean).join(' ') || b.client.email;
    const when = this.shortWhen(b.availability.startsAt);
    const amount = formatNaira(Number(chargedKobo(b)));
    const copy = {
      booked: {
        type: 'consult.booking_created',
        title: 'New booking',
        message:
          `${name} booked ${b.service.title} for ${when}.` +
          (b.status === 'PENDING_PAYMENT'
            ? b.paymentMethod === 'MANUAL'
              ? ` Waiting for a transfer (ref UD-${b.id}).`
              : ' Waiting for payment.'
            : ''),
      },
      paid: { type: 'consult.booking_paid', title: 'Payment received', message: `${name} paid ${amount} for ${when}.` },
      transfer_sent: {
        type: 'consult.transfer_sent',
        title: 'Transfer to confirm',
        message: `${name} says they’ve sent ${amount} (ref UD-${b.id}). Check your account and mark it paid.`,
      },
      cancelled: { type: 'consult.booking_cancelled', title: 'Session cancelled', message: `${name}’s session on ${when} was cancelled.` },
      refunded: {
        type: 'consult.payment_refunded',
        title: 'Payment refunded',
        message: {
          time_taken: `${name}’s ${amount} for ${when} arrived after the time was released and taken, so it is being refunded.`,
          cancelled: `${name} paid ${amount} for ${when}, which was cancelled, so it is being refunded.`,
          duplicate: `${name} paid ${amount} twice for ${when}; the second payment is being refunded.`,
        }[reason],
      },
    }[event];
    await this.notifications
      .notify({
        tenantId: b.tenantId,
        profileIds,
        ...copy,
        link: `/dashboard/sessions/${b.id}`,
        preferenceCategory: 'activity',
      })
      .catch((err) => this.logger.warn(`Could not tell staff about booking ${bookingId}: ${(err as Error).message}`));
  }

  /** A client handed in a form: the practice is told, linked to the client. */
  async notifyFormSubmitted(tenantId: bigint, input: { clientProfileId: bigint; clientName: string; formTitle: string }): Promise<void> {
    const staff = await this.prisma.profile.findMany({
      where: { tenantId, role: { in: ['OWNER', 'ADMIN'] }, status: 'active' },
      select: { id: true },
    });
    await this.notifications
      .notify({
        tenantId,
        profileIds: staff.map((s: { id: bigint }) => s.id),
        type: 'intake.form_submitted',
        title: 'Form received',
        message: `${input.clientName} completed ${input.formTitle}.`,
        link: `/dashboard/clients/${input.clientProfileId}`,
        preferenceCategory: 'activity',
      })
      .catch((err) => this.logger.warn(`Could not report form submission: ${(err as Error).message}`));
  }

  private shortWhen(startsAt: Date): string {
    const day = `${startsAt.toLocaleString('en-GB', { weekday: 'short', timeZone: 'Africa/Lagos' })}, ${startsAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })}`;
    const time = startsAt.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' });
    return `${day} · ${time.replace('am', 'AM').replace('pm', 'PM')}`;
  }

}
