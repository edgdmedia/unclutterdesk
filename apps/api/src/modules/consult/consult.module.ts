import { Module } from '@nestjs/common';
import { ConsultController } from './consult.controller';
import { ConsultService } from './consult.service';
import { ConsultCron } from './consult.cron';
import { ManualPaymentService } from './manual-payment.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsModule } from '../notifications/notification.module';
import { DiscountModule } from '../discount/discount.module';
import { BillingModule } from '../billing/billing.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [NotificationsModule, DiscountModule, BillingModule, CalendarModule],
  controllers: [ConsultController],
  providers: [ConsultService, ConsultCron, ManualPaymentService, PrismaService],
  exports: [ConsultService],
})
export class ConsultModule {}
