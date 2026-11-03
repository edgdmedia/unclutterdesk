import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionLapseService } from './subscription-lapse.service';
import { UnverifiedSignupsService } from '../auth/unverified-signups.service';

@Injectable()
export class BillingCron {
  private readonly logger = new Logger(BillingCron.name);

  constructor(
    private readonly lapse: SubscriptionLapseService,
    private readonly unverified: UnverifiedSignupsService,
  ) {}

  /** Daily: starts lapse timelines the webhooks didn't, and moves practices whose notice has ended to FREE (§5.4a). */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async enforceLapsedSubscriptions() {
    try {
      await this.lapse.enforce();
    } catch (err) {
      this.logger.error('Failed to run the lapse timeline', err as Error);
    }
    // §6.8: the same daily run releases handles and slugs held by unverified
    // owner signups after 7 days (warning on day 5). Kept separate so one
    // failing never stops the other.
    try {
      await this.unverified.run();
    } catch (err) {
      this.logger.error('Failed to release unverified signups', err as Error);
    }
  }
}
