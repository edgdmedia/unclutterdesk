import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PractitionerProfileController } from './practitioner-profile.controller';
import { PractitionerProfileService } from './practitioner-profile.service';

@Module({
  controllers: [PractitionerProfileController],
  providers: [PractitionerProfileService, PrismaService],
  exports: [PractitionerProfileService],
})
export class PractitionerProfileModule {}
