import { Module } from '@nestjs/common';
import { IntakeModule } from '../intake/intake.module';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { CloudflareSaasService } from './cloudflare-saas.service';
import { CustomDomainCron } from './custom-domain.cron';
import { PrismaService } from '../../common/prisma/prisma.service';

@Module({
  imports: [IntakeModule],
  controllers: [TenantController, LocationsController],
  providers: [TenantService, LocationsService, PrismaService, CloudflareSaasService, CustomDomainCron],
  exports: [TenantService, LocationsService, CloudflareSaasService],
})
export class TenantModule {}
