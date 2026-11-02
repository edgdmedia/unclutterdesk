import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PractitionerProfileController } from './practitioner-profile.controller';
import { PractitionerProfileService } from './practitioner-profile.service';
import { ProfilePhotoJob } from './profile-photo.job';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [PractitionerProfileController],
  providers: [PractitionerProfileService, ProfilePhotoJob, PrismaService],
  exports: [PractitionerProfileService],
})
export class PractitionerProfileModule {}
