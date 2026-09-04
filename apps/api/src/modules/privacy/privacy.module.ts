import { Module } from '@nestjs/common';
import { PrivacyController, PlatformPrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { PracticeClosureService } from './practice-closure.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PlatformAdminGuard } from '../admin/platform-admin.guard';

@Module({
  controllers: [PrivacyController, PlatformPrivacyController],
  providers: [PrivacyService, PracticeClosureService, PrismaService, PlatformAdminGuard],
})
export class PrivacyModule {}
