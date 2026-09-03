import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaystackService } from './paystack.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [CalendarModule],
  controllers: [BillingController],
  providers: [BillingService, PaystackService, PrismaService],
  exports: [BillingService, PaystackService],
})
export class BillingModule {}
