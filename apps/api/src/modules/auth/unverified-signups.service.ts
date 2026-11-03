import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { appOrigin } from '../../common/origins';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/notification.service';

const DAY = 24 * 60 * 60 * 1000;
export const RELEASE_AFTER_DAYS = 7;
export const WARN_AFTER_DAYS = 5;
/** Written by the daily run, not a person. */
export const SYSTEM_ACTOR = 0n;
export const WARNING_EMAIL_TYPE = 'auth.unverified_release_warning';

/**
 * Unverified signups give back their handle and slug after 7 days (spec §6.8).
 *
 * Signup creates the account, practice and profile before the email code is
 * entered, so anyone could hold a handle like "chente" with an email they
 * don't own. This covers owner self-signups only: one account whose only
 * membership is an unverified OWNER profile. Clients, staff and invited
 * colleagues are never touched; admin-created practices have no account to
 * match.
 *
 * Nothing is removed if the practice holds anything signup didn't create
 * (bookings, other people, services, availability, payouts, notes, form
 * submissions, places, requests): those are flagged for an admin instead,
 * once. A removal deletes the account, practice, profiles and public profile
 * in one transaction with an audit entry; the handle and slug are freed with
 * no history kept. On day 5 a single warning email goes out.
 */
@Injectable()
export class UnverifiedSignupsService {
  private readonly logger = new Logger(UnverifiedSignupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  /** The daily run: warn on day 5, release from day 7. Returns what happened, for logs and tests. */
  async run(now = new Date()): Promise<{ warned: number; released: number; flagged: number }> {
    const warned = await this.warn(now);
    const { released, flagged } = await this.release(now);
    if (warned || released || flagged) this.logger.log(`Unverified signups: ${warned} warned, ${released} released, ${flagged} flagged for an admin`);
    return { warned, released, flagged };
  }

  /** Owner self-signups still unverified and created before `before`. */
  private candidates(before: Date, after?: Date) {
    return this.prisma.user.findMany({
      where: {
        platformRole: null,
        createdAt: { lt: before, ...(after ? { gte: after } : {}) },
        profiles: {
          some: { role: 'OWNER', emailVerified: false },
          every: { role: 'OWNER', emailVerified: false },
        },
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        practitionerProfile: { select: { id: true, handle: true } },
        profiles: { select: { id: true, tenantId: true, email: true, tenant: { select: { id: true, slug: true, name: true } } } },
      },
      take: 200,
    });
  }

  private async warn(now: Date): Promise<number> {
    const users = await this.candidates(new Date(now.getTime() - WARN_AFTER_DAYS * DAY), new Date(now.getTime() - RELEASE_AFTER_DAYS * DAY));
    let sent = 0;
    for (const user of users) {
      const profile = user.profiles[0];
      if (!profile) continue;
      // Once per account, whatever happens to the email: the audit entry is the marker.
      const already = await this.prisma.adminAuditLog.findFirst({ where: { action: 'signup.warn', targetType: 'User', targetId: user.id.toString() }, select: { id: true } });
      if (already) continue;
      const what = user.practitionerProfile ? `your profile address (${user.practitionerProfile.handle})` : 'your practice address';
      try {
        await this.notifications.sendEmail({
          to: profile.email,
          type: WARNING_EMAIL_TYPE,
          title: 'Verify your email to keep your account',
          message: `Verify your email, or ${what} will be released in 2 days and the account removed. Sign in and enter the code we sent, or ask for a new one.`,
          link: `${appOrigin()}/verify-email`,
          actionLabel: 'Verify my email',
          tenantId: profile.tenantId,
          profileId: profile.id,
        });
        await this.audit.record({
          actorUserId: SYSTEM_ACTOR,
          action: 'signup.warn',
          targetType: 'User',
          targetId: user.id,
          reason: `Email unverified for ${WARN_AFTER_DAYS} days; release warning sent`,
          meta: { email: user.email, handle: user.practitionerProfile?.handle ?? null },
        });
        sent++;
      } catch (err) {
        this.logger.warn(`Release warning not sent for user ${user.id}: ${(err as Error).message}`);
      }
    }
    return sent;
  }

  /** What, beyond signup's own records, a practice holds. Empty means safe to remove. */
  async attachments(tenantId: bigint, ownerProfileId: bigint): Promise<string[]> {
    const where = { tenantId };
    const [bookings, people, services, availability, payouts, notes, submissions, places, requests] = await Promise.all([
      this.prisma.consultBooking.count({ where }),
      this.prisma.profile.count({ where: { tenantId, id: { not: ownerProfileId } } }),
      this.prisma.consultService.count({ where }),
      this.prisma.consultAvailability.count({ where }),
      this.prisma.bankSubaccount.count({ where }),
      this.prisma.clinicalNote.count({ where }),
      this.prisma.universalFormSubmission.count({ where }),
      this.prisma.practitionerPlace.count({ where }),
      this.prisma.platformRequest.count({ where }),
    ]);
    return Object.entries({ bookings, people, services, availability, payouts, notes, submissions, places, requests })
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k}: ${n}`);
  }

  private async release(now: Date): Promise<{ released: number; flagged: number }> {
    const users = await this.candidates(new Date(now.getTime() - RELEASE_AFTER_DAYS * DAY));
    let released = 0;
    let flagged = 0;
    for (const user of users) {
      if (user.profiles.length !== 1 || !user.profiles[0].tenant) continue;
      const profile = user.profiles[0];
      const tenant = profile.tenant!;
      const extra = await this.attachments(tenant.id, profile.id);
      if (extra.length > 0) {
        const seen = await this.prisma.adminAuditLog.findFirst({ where: { action: 'signup.flag', targetType: 'User', targetId: user.id.toString() }, select: { id: true } });
        if (!seen) {
          await this.audit.record({
            actorUserId: SYSTEM_ACTOR,
            action: 'signup.flag',
            targetType: 'User',
            targetId: user.id,
            reason: 'Unverified for 7 days, but the practice holds more than signup created; check before removing',
            meta: { email: user.email, slug: tenant.slug, handle: user.practitionerProfile?.handle ?? null, attached: extra },
          });
          flagged++;
        }
        continue;
      }

      const removed = await this.prisma.$transaction(async (tx) => {
        // Re-check inside the transaction: verified or joined meanwhile means keep.
        const still = await tx.profile.count({ where: { userId: user.id, NOT: { role: 'OWNER', emailVerified: false } } });
        if (still > 0) return false;
        await tx.token.deleteMany({ where: { userId: user.id } });
        await tx.tenant.delete({ where: { id: tenant.id } }); // cascades the profile, therapist record, forms
        await tx.user.delete({ where: { id: user.id } }); // cascades the public profile
        await this.audit.record(
          {
            actorUserId: SYSTEM_ACTOR,
            action: 'signup.release',
            targetType: 'User',
            targetId: user.id,
            reason: `Email unverified for ${RELEASE_AFTER_DAYS} days`,
            meta: { email: user.email, slug: tenant.slug, practice: tenant.name, handle: user.practitionerProfile?.handle ?? null, createdAt: user.createdAt.toISOString() },
          },
          tx,
        );
        return true;
      });
      if (removed) released++;
    }
    return { released, flagged };
  }
}
