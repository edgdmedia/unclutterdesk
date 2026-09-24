import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PlatformAdminGuard } from './platform-admin.guard';
import { AuthModule } from '../auth/auth.module';
import { InviteModule } from '../invites/invite.module';
import { AssessmentModule } from '../assessments/assessment.module';
import { PrismaService } from '../../common/prisma/prisma.service';

@Module({
  imports: [AuthModule, InviteModule, AssessmentModule],
  controllers: [AdminController],
  providers: [AdminService, PlatformAdminGuard, PrismaService],
  exports: [AdminService],
})
export class AdminModule {}
