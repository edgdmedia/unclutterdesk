import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ManualPaymentService } from './manual-payment.service';
import { PaystackService } from '../billing/paystack.service';
import { BookingPaymentSettler } from '../billing/booking-payment-settler.service';
import { BookingNotifier } from '../notifications/booking-notifier.service';
import { ONLINE_HOLD_MINUTES, RELEASE_GRACE_MS } from './online-hold';

@Injectable()
export class ConsultCron {
  private readonly logger = new Logger(ConsultCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly manualPayments: ManualPaymentService,
    private readonly paystack: PaystackService,
    private readonly settler: BookingPaymentSettler,
    @Optional() private readonly notifier?: BookingNotifier,
  ) {}

  /**
   * Releases unpaid holds when they run out: 35 minutes for a client's online
   * checkout (BKG-09), 48 hours or 2 hours before the session for a staff
   * payment link, the session start for a bank transfer.
   *
   * An online hold is released only after asking Paystack whether it was paid,
   * so a payment made in the last minutes is confirmed rather than lost. If
   * Paystack can't be reached the hold waits, up to two hours past its expiry.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleBookingExpiry() {
    const now = new Date();
    const expired = await this.prisma.consultBooking.findMany({
      where: {
        status: 'PENDING_PAYMENT',
        OR: [
          // Every hold made since BKG-09 carries its own expiry.
          { holdExpiresAt: { lt: now } },
          // Online bookings made before holds were recorded.
          { paymentMethod: { not: 'MANUAL' }, holdExpiresAt: null, createdAt: { lt: new Date(now.getTime() - ONLINE_HOLD_MINUTES * 60_000) } },
        ],
      },
      select: { id: true, availabilityId: true, paymentMethod: true, paymentRef: true, holdExpiresAt: true },
    });
    if (expired.length === 0) return;

    let cancelled = 0;
    for (const booking of expired) {
      try {
        if (booking.paymentMethod !== 'MANUAL' && booking.paymentRef) {
          let charge: { status?: string; paid_at?: string | null } | null = null;
          try {
            charge = await this.paystack.verifyTransaction(booking.paymentRef);
          } catch (err) {
            const overdue = now.getTime() - (booking.holdExpiresAt?.getTime() ?? now.getTime());
            if (overdue < RELEASE_GRACE_MS) {
              this.logger.warn(`Paystack unreachable for booking ${booking.id}; keeping its hold for now: ${(err as Error).message}`);
              continue;
            }
          }
          if (charge?.status === 'success') {
            await this.settler.settle(booking.paymentRef, charge);
            continue;
          }
        }

        const released = await this.prisma.$transaction(async (tx) => {
          // Conditional: staff may have marked it paid, or the webhook
          // confirmed it, since the list was read.
          const done = await tx.consultBooking.updateMany({
            where: { id: booking.id, status: 'PENDING_PAYMENT' },
            data: { status: 'CANCELLED', holdReleasedAt: now },
          });
          if (done.count === 0) return false;
          // A time staff made for this booking stays closed: it may be outside working hours.
          await tx.consultAvailability.updateMany({
            where: { id: booking.availabilityId, createdForBooking: false },
            data: { isActive: true },
          });
          return true;
        });
        if (!released) continue;
        cancelled++;
        if (booking.paymentMethod === 'MANUAL') await this.manualPayments.released(booking.id);
        else await this.notifier?.holdReleased(booking.id).catch(() => undefined);
      } catch (error) {
        this.logger.error(`Failed to expire booking ${booking.id}:`, error);
      }
    }
    this.logger.log(`Released ${cancelled} unpaid booking(s).`);
  }
}
