import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Days between a practice requesting closure and its data becoming purgeable.
 * Gives the practice time to export records it is professionally required to
 * keep, and gives us time to reverse a mistake.
 */
export const CLOSURE_GRACE_DAYS = 30;

export interface ClosureRequestResult {
  tenantId: string;
  closureRequestedAt: string;
  purgeableFrom: string;
  message: string;
}

export interface PurgeResult {
  tenantId: string;
  slug: string;
  purgedAt: string;
  deleted: Record<string, number>;
}

@Injectable()
export class PracticeClosureService {
  private readonly logger = new Logger(PracticeClosureService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Step one, run by the practice owner. Deactivates the practice and starts
   * the retention clock. Reversible: nothing is deleted here.
   */
  async requestClosure(
    tenantId: bigint,
    actorProfileId: bigint,
    confirmSlug: string,
  ): Promise<ClosureRequestResult> {
    const actor = await this.prisma.profile.findFirst({
      where: { id: actorProfileId, tenantId },
      select: { role: true },
    });

    // Closing the practice ends everyone's access, so it is the owner's call
    // alone — not an admin's.
    if (!actor || actor.role !== 'OWNER') {
      throw new ForbiddenException('Only the practice owner can close the account');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, closureRequestedAt: true },
    });

    if (!tenant) throw new NotFoundException('Practice not found');

    // Typing the slug is the confirmation step: it makes an accidental or
    // scripted call fail rather than close a live practice.
    if (confirmSlug?.trim().toLowerCase() !== tenant.slug.toLowerCase()) {
      throw new BadRequestException(
        'Confirmation does not match the practice address. Type the practice address exactly to confirm.',
      );
    }

    if (tenant.closureRequestedAt) {
      throw new BadRequestException('Closure has already been requested for this practice');
    }

    const closureRequestedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { isActive: false, closureRequestedAt, closureRequestedBy: actorProfileId },
      });

      // End every session belonging to this practice immediately.
      const profiles = await tx.profile.findMany({
        where: { tenantId, userId: { not: null } },
        select: { userId: true },
      });
      const userIds = profiles
        .map((p) => p.userId)
        .filter((id): id is bigint => id !== null);

      if (userIds.length > 0) {
        await tx.token.deleteMany({ where: { userId: { in: userIds } } });
      }
    });

    const purgeableFrom = new Date(
      closureRequestedAt.getTime() + CLOSURE_GRACE_DAYS * 24 * 60 * 60 * 1000,
    );

    this.logger.warn(
      `Closure requested for tenant ${tenantId} by profile ${actorProfileId}; purgeable from ${purgeableFrom.toISOString()}`,
    );

    return {
      tenantId: tenantId.toString(),
      closureRequestedAt: closureRequestedAt.toISOString(),
      purgeableFrom: purgeableFrom.toISOString(),
      message:
        `The practice is now closed and no longer accepting bookings. Its data will be erased after ` +
        `${CLOSURE_GRACE_DAYS} days. Export anything you are required to retain before then.`,
    };
  }

  /**
   * Step two, run by platform staff. Irreversible.
   *
   * Deletes explicitly and in dependency order rather than relying on
   * `tenant.delete()` cascading. `ConsultBooking.client` references `Profile`
   * with no cascade, so Postgres refuses to remove a client who has booked —
   * a cascade from Tenant can hit that restriction and abort part-way. Doing it
   * in order, in one transaction, either completes or rolls back cleanly.
   */
  async purgeClosedPractice(tenantId: bigint, confirmSlug: string): Promise<PurgeResult> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, closureRequestedAt: true },
    });

    if (!tenant) throw new NotFoundException('Practice not found');

    if (confirmSlug?.trim().toLowerCase() !== tenant.slug.toLowerCase()) {
      throw new BadRequestException('Confirmation does not match the practice address');
    }

    if (!tenant.closureRequestedAt) {
      throw new BadRequestException(
        'This practice has not requested closure. Purging is only available for closed practices.',
      );
    }

    const purgeableFrom = new Date(
      tenant.closureRequestedAt.getTime() + CLOSURE_GRACE_DAYS * 24 * 60 * 60 * 1000,
    );

    if (Date.now() < purgeableFrom.getTime()) {
      throw new BadRequestException(
        `This practice is still within its ${CLOSURE_GRACE_DAYS}-day retention window, which ends ${purgeableFrom.toISOString()}.`,
      );
    }

    const deleted: Record<string, number> = {};

    await this.prisma.$transaction(async (tx) => {
      const profiles = await tx.profile.findMany({
        where: { tenantId },
        select: { id: true, userId: true },
      });
      const userIds = profiles
        .map((p) => p.userId)
        .filter((id): id is bigint => id !== null);

      const count = async (name: string, run: Promise<{ count: number }>) => {
        deleted[name] = (await run).count;
      };

      // Leaves of the graph first.
      await count('clinicalNotes', tx.clinicalNote.deleteMany({ where: { tenantId } }));
      await count('formSubmissions', tx.universalFormSubmission.deleteMany({ where: { tenantId } }));
      await count('forms', tx.universalForm.deleteMany({ where: { tenantId } }));

      // Before profiles: the client relation on a booking is RESTRICT.
      await count('bookings', tx.consultBooking.deleteMany({ where: { tenantId } }));
      await count('availability', tx.consultAvailability.deleteMany({ where: { tenantId } }));
      await count('services', tx.consultService.deleteMany({ where: { tenantId } }));
      await count('discountCodes', tx.discountCode.deleteMany({ where: { tenantId } }));
      await count('pendingInvites', tx.consultPendingInvite.deleteMany({ where: { tenantId } }));
      await count('bankSubaccounts', tx.bankSubaccount.deleteMany({ where: { tenantId } }));

      await count('notificationDispatches', tx.notificationDispatch.deleteMany({ where: { tenantId } }));
      await count('notifications', tx.notification.deleteMany({ where: { tenantId } }));
      await count('notificationPreferences', tx.notificationPreference.deleteMany({ where: { tenantId } }));
      await count('emailLogs', tx.emailLog.deleteMany({ where: { tenantId } }));
      await count('pushSubscriptions', tx.webPushSubscription.deleteMany({ where: { tenantId } }));

      await count('therapistProfiles', tx.consultTherapistProfile.deleteMany({ where: { tenantId } }));

      if (userIds.length > 0) {
        await count('sessions', tx.token.deleteMany({ where: { userId: { in: userIds } } }));
      } else {
        deleted.sessions = 0;
      }

      await count('profiles', tx.profile.deleteMany({ where: { tenantId } }));

      // A login can span practices. Remove only the accounts that now have no
      // profile anywhere, so closing one practice cannot delete a person's
      // access to another.
      let orphanedUsers = 0;
      for (const userId of userIds) {
        const remaining = await tx.profile.count({ where: { userId } });
        if (remaining === 0) {
          await tx.user.delete({ where: { id: userId } });
          orphanedUsers += 1;
        }
      }
      deleted.users = orphanedUsers;

      await tx.tenant.delete({ where: { id: tenantId } });
      deleted.tenant = 1;
    });

    this.logger.warn(
      `Purged tenant ${tenantId} (${tenant.slug}): ${JSON.stringify(deleted)}`,
    );

    return {
      tenantId: tenantId.toString(),
      slug: tenant.slug,
      purgedAt: new Date().toISOString(),
      deleted,
    };
  }
}
