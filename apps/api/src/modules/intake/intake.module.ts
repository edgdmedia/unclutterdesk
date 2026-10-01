import { Module } from '@nestjs/common';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
import { DefaultFormsService } from './default-forms.service';
import { FormTemplateService } from './form-template.service';
import { RequestModule } from '../requests/request.module';
import { PrismaService } from '../../common/prisma/prisma.service';

@Module({
  imports: [RequestModule],
  controllers: [IntakeController],
  providers: [IntakeService, DefaultFormsService, FormTemplateService, PrismaService],
  exports: [IntakeService, DefaultFormsService, FormTemplateService],
})
export class IntakeModule {}
