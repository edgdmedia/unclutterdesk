import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PractitionerProfileController } from './practitioner-profile.controller';
import { PractitionerProfileService } from './practitioner-profile.service';
import { ProfilePhotoJob } from './profile-photo.job';
import { PublicProfileService } from './public-profile.service';
import { PublicProfilesController } from './public-profiles.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [PractitionerProfileController, PublicProfilesController],
  providers: [PractitionerProfileService, PublicProfileService, ProfilePhotoJob, PrismaService],
  exports: [PractitionerProfileService],
})
export class PractitionerProfileModule {}
