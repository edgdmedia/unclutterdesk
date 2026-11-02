import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobsService } from './jobs.service';

/** Background jobs run on the platform's existing 5-minute cadence (spec §4.4). */
@Injectable()
export class JobsCron {
  private readonly logger = new Logger(JobsCron.name);

  constructor(private readonly jobs: JobsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async tick(): Promise<void> {
    try {
      await this.jobs.runDue();
    } catch (err) {
      this.logger.warn(`running background jobs failed: ${(err as Error).message}`);
    }
  }
}
