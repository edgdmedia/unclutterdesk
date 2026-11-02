import { randomBytes } from 'node:crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JobDeferredError, JobsService } from '../jobs/jobs.service';
import { decodeImageDataUrl } from '../storage/images';
import { StorageService } from '../storage/storage.service';

export const PHOTO_BACKFILL_JOB = 'profile.photo-backfill';

export interface PhotoBackfillPayload {
  practitionerProfileId: string;
  /** The practice Profile whose avatarUrl holds the photo. */
  sourceProfileId: string;
}

/**
 * Photo back-fill (spec §6.1): a new profile starts with the photo the
 * therapist already has in their practice. That photo is a base64 data URL
 * in Profile.avatarUrl; this decodes it, checks the bytes really are a JPEG,
 * PNG or WebP within the size limit, uploads it to the public bucket and sets
 * photoKey. avatarUrl is left as it is. A hosted (https) avatar is skipped:
 * the server never fetches an address it was given.
 */
@Injectable()
export class ProfilePhotoJob implements OnModuleInit {
  private readonly logger = new Logger(ProfilePhotoJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit() {
    this.jobs.register(PHOTO_BACKFILL_JOB, (payload) => this.run(payload as PhotoBackfillPayload));
  }

  async run(payload: PhotoBackfillPayload): Promise<void> {
    const profile = await this.prisma.practitionerProfile.findUnique({
      where: { id: BigInt(payload.practitionerProfileId) },
      select: { id: true, userId: true, photoKey: true },
    });
    if (!profile || profile.photoKey) return; // gone, or the therapist already chose a photo

    // The source must be one of this same person's practice profiles.
    const source = await this.prisma.profile.findFirst({
      where: { id: BigInt(payload.sourceProfileId), userId: profile.userId },
      select: { avatarUrl: true },
    });
    if (!source?.avatarUrl) return;

    const image = decodeImageDataUrl(source.avatarUrl);
    if ('problem' in image) {
      this.logger.log(`profile ${profile.id}: practice photo not copied (${image.problem})`);
      return;
    }
    if (!this.storage.configured('public')) throw new JobDeferredError('R2 public bucket is not configured');

    const key = `profiles/${profile.id}/photo-${randomBytes(8).toString('hex')}.${image.extension}`;
    await this.storage.put('public', key, image.bytes, { contentType: image.contentType });

    // Only if no photo was chosen meanwhile; otherwise drop the copy.
    const set = await this.prisma.practitionerProfile.updateMany({
      where: { id: profile.id, photoKey: null },
      data: { photoKey: key },
    });
    if (set.count === 0) await this.storage.remove('public', key);
  }
}
