import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaystackService } from './paystack.service';
import { BookingPaymentSettler } from './booking-payment-settler.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [CalendarModule],
  controllers: [BillingController],
  providers: [BillingService, PaystackService, BookingPaymentSettler, PrismaService],
  exports: [BillingService, PaystackService, BookingPaymentSettler],
})
export class BillingModule {}
