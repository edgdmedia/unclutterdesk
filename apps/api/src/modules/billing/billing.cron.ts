import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionLapseService } from './subscription-lapse.service';

@Injectable()
export class BillingCron {
  private readonly logger = new Logger(BillingCron.name);

  constructor(private readonly lapse: SubscriptionLapseService) {}

  /** Daily: starts lapse timelines the webhooks didn't, and moves practices whose notice has ended to FREE (§5.4a). */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async enforceLapsedSubscriptions() {
    try {
      await this.lapse.enforce();
    } catch (err) {
      this.logger.error('Failed to run the lapse timeline', err as Error);
    }
  }
}
