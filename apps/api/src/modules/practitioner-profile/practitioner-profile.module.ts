import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminProfileContentController } from './admin-profile-content.controller';
import { AdminProfileContentService } from './admin-profile-content.service';
import { PractitionerProfileController } from './practitioner-profile.controller';
import { PractitionerProfileService } from './practitioner-profile.service';
import { ProfilePhotoJob } from './profile-photo.job';
import { ProfilePurgeJob } from './profile-purge.job';
import { ProfilePreviewJob } from './profile-preview.job';
import { ProfileEnsureDraftsJob } from './profile-ensure-drafts.job';
import { PersonFactsService } from './person-facts.service';
import { PublicProfileService } from './public-profile.service';
import { PublicProfilesController } from './public-profiles.controller';
import { StorageModule } from '../storage/storage.module';
import { AuditModule } from '../audit/audit.module';
import { PlatformAdminGuard } from '../admin/platform-admin.guard';
import { AdminProfileReportsController } from './admin-profile-reports.controller';
import { ProfileReportsService } from './profile-reports.service';

@Module({
  imports: [StorageModule, AuditModule],
  controllers: [PractitionerProfileController, PublicProfilesController, AdminProfileReportsController, AdminProfileContentController],
  providers: [
    PractitionerProfileService,
    PublicProfileService,
    ProfileReportsService,
    ProfilePhotoJob,
    ProfilePurgeJob,
    ProfilePreviewJob,
    ProfileEnsureDraftsJob,
    PersonFactsService,
    AdminProfileContentService,
    PlatformAdminGuard,
    PrismaService,
  ],
  exports: [PractitionerProfileService, PersonFactsService],
})
export class PractitionerProfileModule {}