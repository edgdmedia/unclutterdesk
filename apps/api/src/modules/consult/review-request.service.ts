import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { tenantWebOrigin } from '../../common/origins';
import { reviewInviteToken, reviewInviteTokenValid } from './review-invite';
import type { SessionActor } from './session-directory.service';

const name = (p: { firstName?: string | null; lastName?: string | null } | null | undefined, fallback: string) =>
  `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || fallback;

/**
 * Review requests: staff email a client a signed link to the practice's review
 * form, for one completed session.
 *
 * Never automatic. Many therapy ethics codes (APA 5.05, for one) caution
 * against soliciting testimonials from clients still in care, so the
 * practitioner chooses each time, and a session is asked at most once.
 */
@Injectable()
export class ReviewRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  private load(tenantId: bigint, bookingId: bigint, actor?: SessionActor) {
    return this.prisma.consultBooking.findFirst({
      where: {
        id: bookingId,
        tenantId,
        // A therapist asks only their own clients; the desk, anyone's.
        ...(actor && !actor.viewAll ? { availability: { providerProfileId: actor.profileId } } : {}),
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        service: { select: { title: true } },
        availability: { include: { therapist: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
      },
    });
  }

  async send(tenantId: bigint, actor: SessionActor, bookingId: bigint) {
    const b: any = await this.load(tenantId, bookingId, actor);
    if (!b) throw new NotFoundException('Session not found');
    if (b.status !== 'COMPLETED') throw new BadRequestException('Ask for a review once the session is completed.');
    if (b.reviewRequestedAt) throw new BadRequestException('This client was already asked for a review for this session.');
    if (!b.client?.email) throw new BadRequestException('This client has no email address. Add one to their record first.');
    const form = await this.prisma.universalForm.findFirst({
      where: { tenantId, targetType: 'REVIEW', isActive: true },
      select: { id: true },
    });
    if (!form) throw new BadRequestException('Set up a review form under Forms first.');

    // Claimed before the email: two clicks send one email.
    const at = new Date();
    const claimed = await this.prisma.consultBooking.updateMany({
      where: { id: b.id, tenantId, reviewRequestedAt: null },
      data: { reviewRequestedAt: at },
    });
    if (claimed.count === 0) throw new BadRequestException('This client was already asked for a review for this session.');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true, customDomain: true, customDomainStatus: true },
    });
    const practitioner = name(b.availability.therapist?.profile, 'your practitioner');
    const link = `${tenantWebOrigin(tenant as any)}/review?booking=${b.id}&t=${reviewInviteToken(tenantId, b.id)}`;
    try {
      await this.notifications.sendEmail({
        to: b.client.email,
        type: 'bookings.review_request',
        title: `How was your session with ${practitioner}?`,
        message:
          `${tenant?.name ?? 'Your practice'} would value a few words about your ${b.service.title} session with ${practitioner}. ` +
          `It is entirely up to you, and it makes no difference to your care.`,
        link,
        actionLabel: 'Leave a review',
        tenantId,
        profileId: b.client.id,
      });
    } catch (err) {
      // Not sent: free the session to be asked again.
      await this.prisma.consultBooking.updateMany({ where: { id: b.id, tenantId, reviewRequestedAt: at }, data: { reviewRequestedAt: null } });
      throw err;
    }
    return { id: b.id.toString(), reviewRequestedAt: at.toISOString() };
  }

  /** What the review form shows for a signed link. A bad link learns nothing. */
  async invite(tenantId: bigint, bookingId: bigint, token: unknown) {
    if (!reviewInviteTokenValid(tenantId, bookingId, token)) throw new NotFoundException('This review link is not valid.');
    const b: any = await this.load(tenantId, bookingId);
    if (!b) throw new NotFoundException('This review link is not valid.');
    const reviewed = await this.prisma.universalFormSubmission.findFirst({
      where: { tenantId, bookingId: b.id, targetType: 'REVIEW' },
      select: { id: true },
    });
    return {
      firstName: b.client.firstName ?? '',
      practitionerName: name(b.availability.therapist?.profile, 'your practitioner'),
      serviceTitle: b.service.title,
      sessionAt: b.availability.startsAt.toISOString(),
      alreadyReviewed: Boolean(reviewed),
    };
  }
}
