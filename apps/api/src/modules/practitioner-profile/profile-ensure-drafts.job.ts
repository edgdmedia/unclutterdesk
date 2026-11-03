import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { AuditService } from '../audit/audit.service';
import { PractitionerProfileService } from './practitioner-profile.service';

export const ENSURE_DRAFTS_JOB = 'profile.ensure-drafts';
/** Bump to run the back-fill again after a release that needs it. */
export const ENSURE_DRAFTS_VERSION = 'v1';
const SYSTEM_ACTOR = 0n;

/**
 * §6.17 back-fill. Every therapist gets a profile (a DRAFT if they had none),
 * and existing profiles get any empty field filled from their practice
 * record: about from the welcome message, headline from the tagline,
 * credentials and years. A field the therapist has filled is never
 * overwritten. Safe to run again; queued once per version at start-up.
 */
@Injectable()
export class ProfileEnsureDraftsJob implements OnModuleInit {
  private readonly logger = new Logger(ProfileEnsureDraftsJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
    private readonly profiles: PractitionerProfileService,
  ) {}

  async onModuleInit() {
    this.jobs.register(ENSURE_DRAFTS_JOB, async () => {
      await this.run();
    });
    try {
      await this.jobs.enqueue(ENSURE_DRAFTS_JOB, {} as never, { dedupeKey: `${ENSURE_DRAFTS_JOB}:${ENSURE_DRAFTS_VERSION}` });
    } catch (err) {
      this.logger.warn(`Could not queue the profile back-fill: ${(err as Error).message}`);
    }
  }

  async run(): Promise<{ created: number; filled: number; failed: number }> {
    const members = await this.prisma.consultTherapistProfile.findMany({
      where: { profile: { status: 'active', userId: { not: null } } },
      select: {
        profileId: true,
        welcomeMessage: true,
        tagline: true,
        credentials: true,
        yearsExperience: true,
        profile: { select: { userId: true, role: true } },
      },
      // The owner's own practice first, so a person in several practices is filled from it.
      orderBy: { profileId: 'asc' },
    });
    const seen = new Set<string>();
    let created = 0;
    let filled = 0;
    let failed = 0;
    const ordered = [...members].sort((a, b) => Number(b.profile.role === 'OWNER') - Number(a.profile.role === 'OWNER'));
    for (const m of ordered) {
      const userId = m.profile.userId as bigint;
      if (seen.has(userId.toString())) continue;
      seen.add(userId.toString());
      try {
        const result = await this.profiles.ensureDraft(userId, m.profileId);
        if (result.created) {
          created++;
          continue;
        }
        const own = await this.prisma.practitionerProfile.findUnique({
          where: { userId },
          select: { about: true, headline: true, credentialsText: true, selfReportedYears: true },
        });
        if (!own) continue;
        const data: Record<string, unknown> = {};
        if (!own.about?.trim() && m.welcomeMessage?.trim()) data.about = m.welcomeMessage.trim().slice(0, 2000);
        if (!own.headline?.trim() && m.tagline?.trim()) data.headline = m.tagline.trim().slice(0, 120);
        if (!own.credentialsText?.trim() && m.credentials?.trim()) data.credentialsText = m.credentials.trim();
        if (own.selfReportedYears === null && m.yearsExperience !== null) data.selfReportedYears = m.yearsExperience;
        if (Object.keys(data).length) {
          await this.prisma.practitionerProfile.update({ where: { userId }, data });
          filled++;
        }
      } catch (err) {
        failed++;
        this.logger.warn(`Profile back-fill failed for user ${userId}: ${(err as Error).message}`);
      }
    }
    await this.audit.record({
      actorUserId: SYSTEM_ACTOR,
      action: 'profile.backfill',
      targetType: 'System',
      targetId: 0n,
      reason: `§6.17 one home per fact (${ENSURE_DRAFTS_VERSION})`,
      meta: { created, filled, failed },
    });
    this.logger.log(`Profile back-fill: ${created} drafts created, ${filled} filled, ${failed} failed`);
    return { created, filled, failed };
  }
}
