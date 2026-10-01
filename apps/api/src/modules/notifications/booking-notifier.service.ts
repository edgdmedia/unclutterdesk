import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantWebOrigin } from '../../common/origins';
import { chargedKobo } from '../../common/revenue';
import { formatNaira } from '../billing/subscription-plans';
import { NotificationService } from './notification.service';

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
   * A booking was made. Online and awaiting payment: the pay email, no join
   * link. A transfer hold: nothing — announce already sent the bank details.
   * Confirmed at once (free, waived, or staff-made): the confirmed email.
   */
  async booked(bookingId: bigint): Promise<void> {
    const b = await this.load(bookingId);
    if (!b) return;
    if (b.status === 'CONFIRMED') return this.confirmed(bookingId);
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
    const join = b.availability.channel === 'VIDEO' ? roomLink(b.videoRoomName) : null;
    const portal = `${tenantWebOrigin(b.tenant)}/portal`;
    await this.notifications
      .sendEmail({
        to: b.client.email,
        type: 'bookings.confirmed',
        title: 'Your session is booked',
        message:
          `${b.tenant.name} has confirmed your ${b.service.title} with ${await this.therapistName(b.availability.providerProfileId)} ` +
          `on ${this.when(b.availability.startsAt)}.` +
          (join ? ` Join link: ${join}` : '') +
          ` Manage your booking any time — reschedule, cancel, pay or fill in your forms — at ${portal}.`,
        link: join ?? portal,
        actionLabel: join ? 'Join the session' : 'View my bookings',
        tenantId: b.tenantId,
        profileId: b.clientProfileId,
      })
      .catch((err) => this.logger.warn(`Could not send the confirmation email for booking ${bookingId}: ${(err as Error).message}`));
  }
}
