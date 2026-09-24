import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ManualPaymentService } from './manual-payment.service';

/** An online payment that has not completed in this time releases its slot. */
const ONLINE_HOLD_MS = 30 * 60 * 1000;

@Injectable()
export class ConsultCron {
  private readonly logger = new Logger(ConsultCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly manualPayments: ManualPaymentService,
  ) {}

  /**
   * Releases unpaid holds: online payments after 30 minutes, bank transfers
   * when their own hold runs out (48 hours, or the session start).
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleBookingExpiry() {
    const now = new Date();
    const expired = await this.prisma.consultBooking.findMany({
      where: {
        status: 'PENDING_PAYMENT',
        OR: [
          { paymentMethod: { not: 'MANUAL' }, createdAt: { lt: new Date(now.getTime() - ONLINE_HOLD_MS) } },
          { paymentMethod: 'MANUAL', holdExpiresAt: { lt: now } },
        ],
      },
      select: { id: true, availabilityId: true, paymentMethod: true },
    });
    if (expired.length === 0) return;

    let cancelled = 0;
    for (const booking of expired) {
      try {
        const released = await this.prisma.$transaction(async (tx) => {
          // Conditional: staff may have marked it paid, or the webhook
          // confirmed it, since the list was read.
          const done = await tx.consultBooking.updateMany({
            where: { id: booking.id, status: 'PENDING_PAYMENT' },
            data: { status: 'CANCELLED' },
          });
          if (done.count === 0) return false;
          await tx.consultAvailability.update({ where: { id: booking.availabilityId }, data: { isActive: true } });
          return true;
        });
        if (!released) continue;
        cancelled++;
        if (booking.paymentMethod === 'MANUAL') await this.manualPayments.released(booking.id);
      } catch (error) {
        this.logger.error(`Failed to expire booking ${booking.id}:`, error);
      }
    }
    this.logger.log(`Released ${cancelled} unpaid booking(s).`);
  }
}
