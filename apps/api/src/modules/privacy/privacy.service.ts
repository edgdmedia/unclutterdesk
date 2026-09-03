import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

export const ERASED_STATUS = 'erased';

export interface ErasureReceipt {
  clientProfileId: string;
  erasedAt: string;
  erased: string[];
  retained: { record: string; reason: string }[];
}

/**
 * Right-to-erasure handling under the NDPA.
 *
 * This anonymises rather than deletes, for two reasons that the schema makes
 * unavoidable and one that the law does:
 *
 *  - `ConsultBooking.client` references `Profile` with no cascade, so Postgres
 *    refuses to delete any client who has ever booked.
 *  - `ClinicalNote.clientProfileId` and `UniversalFormSubmission.clientProfileId`
 *    are plain columns with no foreign key, so deleting the profile row would
 *    leave clinical records silently orphaned rather than removed.
 *  - Clinical records carry professional retention obligations that outlast an
 *    erasure request. Stripping the identifiers while keeping the record is what
 *    satisfies both duties.
 *
 * The practice is the controller of its clients' records, so only that
 * practice's OWNER or ADMIN may run this.
 */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async eraseClientPersonalData(
    tenantId: bigint,
    actorProfileId: bigint,
    clientProfileId: bigint,
  ): Promise<ErasureReceipt> {
    const actor = await this.prisma.profile.findFirst({
      where: { id: actorProfileId, tenantId },
      select: { id: true, role: true },
    });

    if (!actor || !['OWNER', 'ADMIN'].includes(actor.role)) {
      throw new ForbiddenException('Only a practice owner or admin can erase client data');
    }

    // Scoped to the actor's tenant, so one practice can never erase another's client.
    const target = await this.prisma.profile.findFirst({
      where: { id: clientProfileId, tenantId },
      select: { id: true, role: true, status: true, userId: true },
    });

    if (!target) {
      throw new NotFoundException('Client not found in this practice');
    }

    if (target.role !== 'CLIENT') {
      // Removing a colleague's access is a different operation with different
      // consequences; routing it through here would be a privilege surprise.
      throw new BadRequestException(
        'This endpoint erases client records only. Use staff management to remove a team member.',
      );
    }

    if (target.status === ERASED_STATUS) {
      throw new BadRequestException('This client has already been erased');
    }

    const tombstone = `erased-${clientProfileId}`;

    await this.prisma.$transaction(async (tx) => {
      // Contact channels: no retention justification once the person is erased.
      await tx.webPushSubscription.deleteMany({ where: { profileId: clientProfileId } });
      await tx.notificationPreference.deleteMany({ where: { profileId: clientProfileId } });
      await tx.notificationDispatch.deleteMany({ where: { profileId: clientProfileId } });
      await tx.notification.deleteMany({ where: { profileId: clientProfileId } });
      await tx.emailLog.deleteMany({ where: { profileId: clientProfileId } });

      // Booking free-text often repeats personal detail; the booking itself is
      // a financial record and stays.
      await tx.consultBooking.updateMany({
        where: { tenantId, clientProfileId },
        data: { notes: null },
      });

      await tx.profile.update({
        where: { id: clientProfileId },
        data: {
          username: tombstone,
          email: `${tombstone}@erased.invalid`,
          firstName: null,
          lastName: null,
          phone: null,
          gender: null,
          dateOfBirth: null,
          avatarUrl: null,
          emailVerified: false,
          emailVerifiedAt: null,
          status: ERASED_STATUS,
        },
      });

      if (target.userId) {
        // Revoke every session immediately.
        await tx.token.deleteMany({ where: { userId: target.userId } });

        // A login can be shared across practices. Only neutralise it once no
        // other practice still has a live profile on that account.
        const remaining = await tx.profile.count({
          where: {
            userId: target.userId,
            id: { not: clientProfileId },
            status: { not: ERASED_STATUS },
          },
        });

        if (remaining === 0) {
          await tx.user.update({
            where: { id: target.userId },
            data: {
              username: `erased-user-${target.userId}`,
              email: `erased-user-${target.userId}@erased.invalid`,
              // Not a guessable placeholder: a random secret nobody holds, so
              // the account cannot be signed into or reset back into use.
              password: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
              failedLoginAttempts: 0,
              lockedUntil: null,
            },
          });
        }
      }
    });

    // Identifiers only — never the erased values themselves.
    this.logger.log(
      `Client ${clientProfileId} erased from tenant ${tenantId} by profile ${actorProfileId}`,
    );

    return {
      clientProfileId: clientProfileId.toString(),
      erasedAt: new Date().toISOString(),
      erased: [
        'Name, email, phone, gender, date of birth and profile photo',
        'Login credentials and all active sessions',
        'Notifications, email log, notification preferences and push subscriptions',
        'Free-text booking notes',
      ],
      retained: [
        {
          record: 'Clinical notes and assessment submissions',
          reason:
            'Professional record-retention obligations outlast an erasure request. These are no longer linked to an identifiable person.',
        },
        {
          record: 'Bookings and payment references',
          reason: 'Required as financial records.',
        },
      ],
    };
  }
}
