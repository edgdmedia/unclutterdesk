import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaystackService } from './paystack.service';
import { BookingPaymentSettler } from './booking-payment-settler.service';
import { BillingCron } from './billing.cron';
import { SubscriptionLapseService } from './subscription-lapse.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [CalendarModule],
  controllers: [BillingController],
  providers: [BillingService, PaystackService, BookingPaymentSettler, PrismaService, BillingCron, SubscriptionLapseService],
  exports: [BillingService, PaystackService, BookingPaymentSettler, SubscriptionLapseService],
})
export class BillingModule {}
