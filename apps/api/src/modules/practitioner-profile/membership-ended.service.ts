import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { appOrigin } from '../../common/origins';
import { JobsService } from '../jobs/jobs.service';
import { NotificationService } from '../notifications/notification.service';
import { profileTag, queuePurge } from './profile-purge.job';

const PLACE_SELECT = {
  id: true,
  profileId: true,
  tenant: { select: { name: true } },
  profile: { select: { id: true, handle: true, status: true, bookingMode: true, user: { select: { email: true } } } },
} as const;

/**
 * §6.14 Leaving a practice. There is no single "membership ended" event in the
 * code, only separate exits, and every one of them calls this service:
 *  1. the therapist status toggle (`ConsultService.adminUpdateTherapistStatus`);
 *  2. a downgrade pausing staff (`SubscriptionLapseService`, §5.4a);
 *  3. a platform admin switching a practice off (`AdminService.updateTenant`);
 *  4. a practice closure (`PracticeClosureService.requestClosure`).
 * A future "remove a staff member" action must call it too.
 *
 * Each exit removes only that practice's place on the therapist's public
 * profile, promotes the next place if it was the main one, falls back to
 * `NONE` when a DESK profile has no places left, purges the public page and
 * emails the therapist. Running it twice for the same exit does nothing the
 * second time. Solo status (§6.16) is derived from active memberships when
 * read, so there is nothing stored to recompute here.
 *
 * Reactivating a membership never re-adds the place: the therapist is told
 * they can add the practice back.
 */
@Injectable()
export class MembershipEndedService {
  private readonly logger = new Logger(MembershipEndedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly notifications: NotificationService,
  ) {}

  /** One or more memberships (Profile ids in a practice) have ended. */
  async onMembershipEnded(therapistProfileIds: bigint[]): Promise<void> {
    if (!therapistProfileIds.length) return;
    await this.removePlaces({ therapistProfileId: { in: therapistProfileIds } });
  }

  /** A whole practice was switched off or closed: everyone in it has left. */
  async onPracticeEnded(tenantId: bigint): Promise<void> {
    await this.removePlaces({ tenantId });
  }

  /** Memberships became active again. The place is not re-added (§6.14). */
  async onMembershipReactivated(therapistProfileIds: bigint[]): Promise<void> {
    if (!therapistProfileIds.length) return;
    await this.offerAddBack({ id: { in: therapistProfileIds } });
  }

  /** A practice was switched back on. */
  async onPracticeReactivated(tenantId: bigint): Promise<void> {
    await this.offerAddBack({ tenantId });
  }

  private async removePlaces(where: Prisma.PractitionerPlaceWhereInput) {
    const places = await this.prisma.practitionerPlace.findMany({ where, select: PLACE_SELECT });
    for (const place of places) {
      const remaining = await this.prisma.$transaction(async (tx) => {
        await tx.practitionerPlace.delete({ where: { id: place.id } });
        const next = await tx.practitionerPlace.findFirst({
          where: { profileId: place.profileId },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: { id: true },
        });
        // Read inside the transaction, not from the list loaded above: an
        // earlier place in this run may already have promoted this one.
        if (next && !(await tx.practitionerPlace.findFirst({ where: { profileId: place.profileId, isMain: true }, select: { id: true } }))) {
          await tx.practitionerPlace.update({ where: { id: next.id }, data: { isMain: true } });
        }
        if (!next && place.profile.bookingMode === 'DESK') {
          await tx.practitionerProfile.update({ where: { id: place.profileId }, data: { bookingMode: 'NONE' } });
        }
        return next ? 1 : 0;
      });

      if (place.profile.status === 'PUBLISHED') {
        await queuePurge(this.jobs, [profileTag(place.profile.handle)]);
      }
      await this.email(place.profile.user.email, {
        type: 'profile.place_removed',
        title: `Your profile no longer books through ${place.tenant.name}`,
        message:
          `Your profile no longer books through ${place.tenant.name}.` +
          (remaining ? '' : ' Set up your own booking in one step: your own free practice, with booking, payments and notes, ready for your profile.'),
        link: remaining ? `${appOrigin()}/dashboard/profile` : `${appOrigin()}/dashboard/profile/own-booking`,
        actionLabel: remaining ? 'Open your profile' : 'Set up my own booking',
      });
    }
  }

  private async offerAddBack(where: Prisma.ProfileWhereInput) {
    const memberships = await this.prisma.profile.findMany({
      where: { ...where, userId: { not: null } },
      select: {
        id: true,
        tenant: { select: { name: true } },
        user: { select: { email: true, practitionerProfile: { select: { id: true, places: { select: { id: true, therapistProfileId: true } } } } } },
      },
    });
    for (const m of memberships) {
      const own = m.user?.practitionerProfile;
      if (!own || !m.user) continue;
      if (own.places.some((p) => p.therapistProfileId === m.id)) continue;
      await this.email(m.user.email, {
        type: 'profile.place_can_return',
        title: `You can add ${m.tenant.name} back to your profile`,
        message: `Your account at ${m.tenant.name} is active again. Your profile doesn't book through it yet: you can add ${m.tenant.name} back from your profile's booking settings.`,
        link: `${appOrigin()}/dashboard/profile`,
        actionLabel: 'Open your profile',
      });
    }
  }

  /** An email failing must never undo or block the place change, which is already stored. */
  private async email(to: string, e: { type: string; title: string; message: string; link: string; actionLabel: string }) {
    try {
      await this.notifications.sendEmail({ to, ...e });
    } catch (err) {
      this.logger.warn(`Could not send ${e.type}: ${(err as Error).message}`);
    }
  }
}
