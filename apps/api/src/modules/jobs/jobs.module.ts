import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JobsCron } from './jobs.cron';
import { JobsService } from './jobs.service';

/** Global: one JobsService (one handler registry) shared by every module that enqueues or handles jobs. */
@Global()
@Module({
  providers: [JobsService, JobsCron, PrismaService],
  exports: [JobsService],
})
export class JobsModule {}
