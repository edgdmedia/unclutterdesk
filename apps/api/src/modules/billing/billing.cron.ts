import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingService } from './billing.service';

@Injectable()
export class BillingCron {
  private readonly logger = new Logger(BillingCron.name);

  constructor(private readonly billing: BillingService) {}

  /** Daily: lapsed subscriptions move to FREE once their paid month or grace period is over. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async enforceLapsedSubscriptions() {
    try {
      await this.billing.enforceLapsedSubscriptions();
    } catch (err) {
      this.logger.error('Failed to enforce lapsed subscriptions', err as Error);
    }
  }
}
