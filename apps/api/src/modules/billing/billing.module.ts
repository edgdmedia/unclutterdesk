import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { StripeController } from './stripe.controller';
import { BillingService } from './billing.service';
import { PaystackService } from './paystack.service';
import { StripeService } from './stripe.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [CalendarModule],
  controllers: [BillingController, StripeController],
  providers: [BillingService, PaystackService, StripeService, PrismaService],
  exports: [BillingService, PaystackService, StripeService],
})
export class BillingModule {}
