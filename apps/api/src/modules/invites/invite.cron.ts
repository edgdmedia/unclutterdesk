import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InviteService } from './invite.service';

@Injectable()
export class InviteCron {
  private readonly logger = new Logger(InviteCron.name);

  constructor(private readonly invites: InviteService) {}

  /** Hourly, so a practice keeps its trial plan at most an hour past its end date. */
  @Cron(CronExpression.EVERY_HOUR)
  async endComplimentaryPeriods() {
    try {
      await this.invites.expireComplimentary();
    } catch (err) {
      this.logger.error('Failed to end complimentary periods', err as Error);
    }
  }
}
