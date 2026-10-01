import { Module } from '@nestjs/common';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
import { DefaultFormsService } from './default-forms.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Module({
  controllers: [IntakeController],
  providers: [IntakeService, DefaultFormsService, PrismaService],
  exports: [IntakeService, DefaultFormsService],
})
export class IntakeModule {}
