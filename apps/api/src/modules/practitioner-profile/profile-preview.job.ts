import { randomBytes } from 'node:crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PROFILE_PUBLIC_ORIGIN } from '../../common/origins';
import { JobDeferredError, JobsService } from '../jobs/jobs.service';
import { StorageService } from '../storage/storage.service';
import { profileTag, queuePurge } from './profile-purge.job';
import { PRACTITIONER_KIND_LABELS } from './kinds';
import { renderPreviewPng } from './share/preview-image';

export const PREVIEW_JOB = 'profile.preview';

export interface PreviewPayload {
  practitionerProfileId: string;
}

/** Up to two initials, skipping a title: "Dr. Folake Adeyemi" → "FA". */
export function initialsOf(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .filter((w, i, all) => !(i === 0 && all.length > 1 && /^(dr|mr|mrs|ms|miss|prof|rev|pastor)$/i.test(w)));
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Link-preview images (spec §6.3). After a published profile changes, this
 * renders its 1200 × 630 card in the profile's layout and palette, stores it
 * in the public bucket under a new key, points previewImageKey at it, removes
 * the old one, and purges the page so og:image updates. The photo is read
 * from our own bucket by key; nothing is fetched from an address.
 * Unpublished profiles are skipped: nothing links to them.
 */
@Injectable()
export class ProfilePreviewJob implements OnModuleInit {
  private readonly logger = new Logger(ProfilePreviewJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit() {
    this.jobs.register(PREVIEW_JOB, (payload) => this.run(payload as PreviewPayload));
  }

  async run(payload: PreviewPayload): Promise<void> {
    const profile = await this.prisma.practitionerProfile.findUnique({
      where: { id: BigInt(payload.practitionerProfileId) },
      select: {
        id: true, handle: true, status: true, displayName: true, kind: true, headline: true, city: true, countryCode: true,
        photoKey: true, previewImageKey: true, layoutKey: true, themeKey: true, brandColor: true,
      },
    });
    if (!profile || profile.status !== 'PUBLISHED') return;
    if (!this.storage.configured('public')) throw new JobDeferredError('R2 public bucket is not configured');

    const photo = profile.photoKey ? await this.storage.get('public', profile.photoKey) : null;
    const png = await renderPreviewPng({
      name: profile.displayName,
      kindLabel: PRACTITIONER_KIND_LABELS[profile.kind] ?? 'Therapist',
      headline: profile.headline,
      place: [profile.city, countryName(profile.countryCode)].filter(Boolean).join(' · ') || null,
      address: `${PROFILE_PUBLIC_ORIGIN.replace(/^https?:\/\//, '')}/${profile.handle}`,
      layoutKey: profile.layoutKey,
      themeKey: profile.themeKey,
      brandColor: profile.brandColor,
      photo,
      initials: initialsOf(profile.displayName),
    });

    const key = `profiles/${profile.id}/preview-${randomBytes(8).toString('hex')}.png`;
    await this.storage.put('public', key, png, { contentType: 'image/png' });

    // Swap only if nobody else swapped meanwhile; otherwise this render is stale.
    const swapped = await this.prisma.practitionerProfile.updateMany({
      where: { id: profile.id, previewImageKey: profile.previewImageKey },
      data: { previewImageKey: key },
    });
    if (swapped.count === 0) {
      await this.storage.remove('public', key);
      return;
    }
    if (profile.previewImageKey) {
      await this.storage.remove('public', profile.previewImageKey).catch((err) =>
        this.logger.warn(`profile ${profile.id}: old preview not removed (${(err as Error).message})`),
      );
    }
    await queuePurge(this.jobs, [profileTag(profile.handle)]);
  }
}
