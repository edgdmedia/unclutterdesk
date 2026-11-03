import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PractitionerProfileController } from './practitioner-profile.controller';
import { PractitionerProfileService } from './practitioner-profile.service';
import { ProfilePhotoJob } from './profile-photo.job';
import { ProfilePurgeJob } from './profile-purge.job';
import { PublicProfileService } from './public-profile.service';
import { PublicProfilesController } from './public-profiles.controller';
import { StorageModule } from '../storage/storage.module';
import { PlatformAdminGuard } from '../admin/platform-admin.guard';
import { AdminProfileReportsController } from './admin-profile-reports.controller';
import { ProfileReportsService } from './profile-reports.service';

@Module({
  imports: [StorageModule],
  controllers: [PractitionerProfileController, PublicProfilesController, AdminProfileReportsController],
  providers: [
    PractitionerProfileService,
    PublicProfileService,
    ProfileReportsService,
    ProfilePhotoJob,
    ProfilePurgeJob,
    PlatformAdminGuard,
    PrismaService,
  ],
  exports: [PractitionerProfileService],
})
export class PractitionerProfileModule {}
