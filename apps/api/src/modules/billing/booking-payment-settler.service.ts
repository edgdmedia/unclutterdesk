import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaystackService } from './paystack.service';
import { BookingNotifier, type RefundReason } from '../notifications/booking-notifier.service';
import { CalendarService } from '../calendar/calendar.service';

export type SettleOutcome = 'confirmed' | 'already' | 'reconfirmed' | 'refunded' | 'ignored';

type PaidCharge = { status?: string; paid_at?: string | null } | null | undefined;

/**
 * BKG-09: the one place that decides what a successful Paystack charge for a
 * booking means. The webhook, the pop-up's confirm call and the expiry job all
 * come here, so a payment is handled the same way whichever arrives first:
 * confirm a pending booking (once), re-confirm a released hold whose time is
 * still free, and otherwise refund the charge in full.
 */
@Injectable()
export class BookingPaymentSettler {
  private readonly logger = new Logger(BookingPaymentSettler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
    @Optional() private readonly notifier?: BookingNotifier,
    @Optional() private readonly calendar?: CalendarService,
  ) {}

  async settle(reference: string, charge: PaidCharge): Promise<SettleOutcome> {
    if (!/^booking-\d+-/.test(reference) || charge?.status !== 'success') return 'ignored';
    const bookingId = BigInt(reference.split('-')[1]);
    const paidAt = new Date(charge.paid_at || Date.now());

    // The usual case: the booking is still waiting for this very payment. The
    // status is part of the match, so a replay or a race confirms it only once.
    const flipped = await this.prisma.consultBooking.updateMany({
      where: { paymentRef: reference, status: 'PENDING_PAYMENT' },
      data: { status: 'CONFIRMED', paidAt },
    });
    if (flipped.count === 1) return this.confirmed(bookingId, 'confirmed');

    const b = await this.prisma.consultBooking.findUnique({
      where: { id: bookingId },
      select: {
        id: true, status: true, paymentRef: true, holdReleasedAt: true, refundRef: true, availabilityId: true,
        availability: { select: { createdForBooking: true } },
      },
    });
    if (!b) return 'ignored';
    if (b.refundRef === reference) return 'already';
    if ((b.status === 'CONFIRMED' || b.status === 'COMPLETED') && b.paymentRef === reference) return 'already';

    if (b.status === 'PENDING_PAYMENT') {
      // An older attempt's reference was paid while a newer one was open.
      const done = await this.prisma.consultBooking.updateMany({
        where: { id: b.id, status: 'PENDING_PAYMENT' },
        data: { status: 'CONFIRMED', paymentRef: reference, paidAt },
      });
      if (done.count === 1) return this.confirmed(b.id, 'confirmed');
    }

    if (b.status === 'CANCELLED' && b.holdReleasedAt) {
      const reclaimed = await this.prisma.$transaction(async (t) => {
        const free = b.availability?.createdForBooking
          ? // A time staff made for this booking is never reopened; it's free if nobody else holds it.
            (await t.consultBooking.count({ where: { availabilityId: b.availabilityId, status: { not: 'CANCELLED' } } })) === 0
          : (await t.consultAvailability.updateMany({ where: { id: b.availabilityId, isActive: true }, data: { isActive: false } })).count === 1;
        if (!free) return false;
        const done = await t.consultBooking.updateMany({
          where: { id: b.id, status: 'CANCELLED' },
          data: { status: 'CONFIRMED', paymentRef: reference, paidAt, holdReleasedAt: null },
        });
        return done.count === 1;
      });
      if (reclaimed) return this.confirmed(b.id, 'reconfirmed');
    }

    // Before giving money back, look again: a concurrent call for this same
    // payment (webhook and pop-up together) may have just confirmed with it.
    const now = await this.prisma.consultBooking.findUnique({ where: { id: b.id }, select: { status: true, paymentRef: true, refundRef: true } });
    if (now?.refundRef === reference) return 'already';
    if ((now?.status === 'CONFIRMED' || now?.status === 'COMPLETED') && now.paymentRef === reference) return 'already';

    // The time is gone, the booking was cancelled, or it's a second charge.
    const reason: RefundReason =
      b.status === 'CONFIRMED' || b.status === 'COMPLETED' ? 'duplicate' : b.holdReleasedAt ? 'time_taken' : 'cancelled';
    await this.paystack.refundTransaction(reference);
    await this.prisma.consultBooking.update({ where: { id: b.id }, data: { refundedAt: new Date(), refundRef: reference } });
    await this.notifier
      ?.latePaymentRefunded(b.id, reason)
      .catch((err) => this.logger.warn(`Could not send the refund notices for booking ${b.id}: ${(err as Error).message}`));
    return 'refunded';
  }

  /** The booking is paid: its calendar event and the one confirmation email follow. */
  private async confirmed(bookingId: bigint, outcome: 'confirmed' | 'reconfirmed'): Promise<SettleOutcome> {
    await this.calendar
      ?.pushBookingToGoogle(bookingId)
      .catch((err) => this.logger.warn(`Could not add booking ${bookingId} to Google Calendar: ${(err as Error).message}`));
    await this.notifier
      ?.confirmed(bookingId)
      .catch((err) => this.logger.warn(`Could not send the confirmation for booking ${bookingId}: ${(err as Error).message}`));
    return outcome;
  }
}
