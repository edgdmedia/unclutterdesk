import { Module } from '@nestjs/common';
import { ConsultController } from './consult.controller';
import { ConsultService } from './consult.service';
import { ConsultCron } from './consult.cron';
import { SessionReminderService } from './session-reminders.service';
import { ManualPaymentService } from './manual-payment.service';
import { StaffBookingService } from './staff-booking.service';
import { SessionDirectoryService } from './session-directory.service';
import { ReviewRequestService } from './review-request.service';
import { PlanSessionService } from './plan-session.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsModule } from '../notifications/notification.module';
import { DiscountModule } from '../discount/discount.module';
import { BillingModule } from '../billing/billing.module';
import { CalendarModule } from '../calendar/calendar.module';
import { PractitionerProfileModule } from '../practitioner-profile/practitioner-profile.module';

@Module({
  imports: [NotificationsModule, DiscountModule, BillingModule, CalendarModule, PractitionerProfileModule],
  controllers: [ConsultController],
  providers: [ConsultService, ConsultCron, SessionReminderService, ManualPaymentService, StaffBookingService, SessionDirectoryService, ReviewRequestService, PlanSessionService, PrismaService],
  exports: [ConsultService],
})
export class ConsultModule {}
