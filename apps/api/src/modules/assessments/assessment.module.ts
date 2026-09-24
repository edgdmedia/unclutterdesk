import { Module } from '@nestjs/common';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';
import { InstrumentService } from './instrument.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Module({
  controllers: [AssessmentController],
  providers: [AssessmentService, InstrumentService, PrismaService],
  exports: [AssessmentService, InstrumentService],
})
export class AssessmentModule {}
