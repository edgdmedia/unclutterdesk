import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';
import { JournalSuiteClient } from './journal-suite.client';

@Module({
  controllers: [JournalController],
  providers: [JournalService, JournalSuiteClient, PrismaService],
  exports: [JournalService],
})
export class JournalModule {}
