import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InviteService } from './invite.service';

@Injectable()
export class InviteCron {
  private readonly logger = new Logger(InviteCron.name);

  constructor(private readonly invites: InviteService) {}

  /**
   * Hourly, so a practice keeps a complimentary plan at most an hour past its
   * end date; also queues the "free until" and 14-/3-day reminder emails.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async endComplimentaryPeriods() {
    try {
      await this.invites.expireComplimentary();
    } catch (err) {
      this.logger.error('Failed to end complimentary periods', err as Error);
    }
    try {
      await this.invites.queueComplimentaryEmails();
    } catch (err) {
      this.logger.error('Failed to queue complimentary plan emails', err as Error);
    }
  }
}
