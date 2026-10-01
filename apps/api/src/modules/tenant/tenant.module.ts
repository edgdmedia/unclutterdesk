import { Module } from '@nestjs/common';
import { IntakeModule } from '../intake/intake.module';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Module({
  imports: [IntakeModule],
  controllers: [TenantController],
  providers: [TenantService, PrismaService],
  exports: [TenantService],
})
export class TenantModule {}
