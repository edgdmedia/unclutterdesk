import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaService } from './common/prisma/prisma.service';
import { HealthController } from './common/health.controller';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { TenantModule } from './modules/tenant/tenant.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConsultModule } from './modules/consult/consult.module';
import { IntakeModule } from './modules/intake/intake.module';
import { NotesModule } from './modules/notes/notes.module';
import { BillingModule } from './modules/billing/billing.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notification.module';
import { DiscountModule } from './modules/discount/discount.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CalendarModule } from './modules/calendar/calendar.module';
import { PrivacyModule } from './modules/privacy/privacy.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // ONE global tier only. ThrottlerGuard enforces *every* named throttler on
    // *every* route (it ANDs the results), so a second "strict" tier defined here
    // would cap the whole API at the strict limit rather than only sensitive
    // routes. Sensitive endpoints opt into a tighter limit with @Throttle(...),
    // which overrides this tier per-route — see auth.controller.ts.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 60 seconds
        limit: 200, // per client IP; a dashboard load fans out to many calls
      },
    ]),
    TenantModule,
    AuthModule,
    ConsultModule,
    IntakeModule,
    NotesModule,
    BillingModule,
    AdminModule,
    NotificationsModule,
    DiscountModule,
    CalendarModule,
    PrivacyModule,
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      // /health must not depend on a tenant lookup: the middleware queries the
      // database, so leaving it in would make the probe fail in the middleware
      // and report 500 instead of the controller's 503.
      .exclude({ path: 'health', method: RequestMethod.ALL })
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
