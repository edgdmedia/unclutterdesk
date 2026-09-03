import { Module } from '@nestjs/common';
import { PrivacyController, PlatformPrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { PracticeClosureService } from './practice-closure.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Module({
  controllers: [PrivacyController, PlatformPrivacyController],
  providers: [PrivacyService, PracticeClosureService, PrismaService],
})
export class PrivacyModule {}
