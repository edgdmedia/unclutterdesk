import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantWebOrigin } from '../../common/origins';
import { parseRich, richToText, taskStates } from '../../common/rich-text';
import { NotificationService } from '../notifications/notification.service';
import { AssessmentService, type SessionAssessment } from '../assessments/assessment.service';
import type { SessionActor } from './session-directory.service';

/** More than this many at once is a battery, not homework. */
export const MAX_RECAP_ASSESSMENTS = 6;
const MAX_TICKS = 500;

const fullName = (p: { firstName?: string | null; lastName?: string | null } | null | undefined) =>
  `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim();

/**
 * The session recap as the client receives it.
 *
 * The practitioner writes it on the session page (formatted, common/rich-text)
 * and may attach assessments. Sending assigns those assessments for this
 * session and emails the whole recap, formatted, with a link to start each
 * one; the same recap is a page in the client's portal, where the client can
 * tick its tick-box items as they go.
 */
@Injectable()
export class SessionRecapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly assessments: AssessmentService,
  ) {}

  private scope(tenantId: bigint, actor: SessionActor, bookingId: bigint) {
    return { id: bookingId, tenantId, ...(actor.viewAll ? {} : { availability: { providerProfileId: actor.profileId } }) };
  }

  /** The assessments chosen for the recap. Checked now, so a problem shows while writing, not on send. */
  async setAttachments(tenantId: bigint, actor: SessionActor, bookingId: bigint, raw: unknown) {
    if (!Array.isArray(raw) || raw.some((k) => typeof k !== 'string' || !/^[A-Z0-9_]{1,40}$/.test(k))) {
      throw new BadRequestException('Choose assessments from the library.');
    }
    if (!actor.clinical) throw new ForbiddenException('Only clinical staff can send assessments.');
    const keys = [...new Set(raw as string[])];
    if (keys.length > MAX_RECAP_ASSESSMENTS) throw new BadRequestException(`Attach at most ${MAX_RECAP_ASSESSMENTS} assessments to one recap.`);
    const b = await this.prisma.consultBooking.findFirst({ where: this.scope(tenantId, actor, bookingId), select: { id: true } });
    if (!b) throw new NotFoundException('Session not found');
    await this.assessments.assertSendable(tenantId, keys);
    await this.prisma.consultBooking.update({ where: { id: b.id }, data: { recapAssessmentKeys: keys } });
    return { recapAssessmentKeys: keys };
  }

  /** What the session page shows under the recap: what is attached, and what has gone. */
  async staffView(tenantId: bigint, actor: SessionActor, bookingId: bigint) {
    const b = await this.prisma.consultBooking.findFirst({
      where: this.scope(tenantId, actor, bookingId),
      select: { id: true, clientProfileId: true, recapAssessmentKeys: true },
    });
    if (!b) throw new NotFoundException('Session not found');
    return {
      recapAssessmentKeys: b.recapAssessmentKeys ?? [],
      sentAssessments: await this.assessments.forSession(tenantId, b.clientProfileId, b.id),
    };
  }

  async send(tenantId: bigint, actor: SessionActor, bookingId: bigint) {
    const b = await this.prisma.consultBooking.findFirst({
      where: this.scope(tenantId, actor, bookingId),
      include: {
        client: { select: { id: true, email: true, firstName: true, timezone: true } },
        service: { select: { title: true } },
        availability: { select: { startsAt: true } },
      },
    });
    if (!b) throw new NotFoundException('Session not found');
    const doc = parseRich(b.clientRecap);
    if (!richToText(doc).trim()) throw new BadRequestException('Write the recap before sending it.');
    if (!b.client.email) throw new BadRequestException('This client has no email address to send the recap to.');

    // Assigned now, for this session; one already sent for it is not sent again.
    const keys = b.recapAssessmentKeys ?? [];
    if (keys.length && !actor.clinical) throw new ForbiddenException('Only clinical staff can send assessments.');
    const assigned: SessionAssessment[] = keys.length
      ? await this.assessments.assignForSession(tenantId, actor.profileId, b.client.id, b.id, keys)
      : await this.assessments.forSession(tenantId, b.client.id, b.id);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true, customDomain: true, customDomainStatus: true },
    });
    const origin = tenantWebOrigin(tenant as any);
    const when = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: b.client.timezone || 'Africa/Lagos',
    }).format(b.availability.startsAt);
    const open = assigned.filter((a) => a.status === 'SENT');

    await this.notifications.sendEmail({
      to: b.client.email,
      type: 'bookings.session_recap',
      title: `Your recap from ${b.service.title}`,
      message:
        `${b.client.firstName ?? 'Hello'}, here is the recap from your session on ${when}. It is also in your client portal, where you can tick things off as you go.` +
        (open.length ? `\n\nYour practitioner has also asked you to complete ${open.length === 1 ? 'a short questionnaire' : `${open.length} short questionnaires`}: the link${open.length === 1 ? ' is' : 's are'} below.` : ''),
      richBody: doc,
      link: `${origin}/portal/sessions/${b.id}/recap`,
      actionLabel: 'Open in my portal',
      links: open.map((a) => ({ label: `Start ${a.shortName} (about ${a.estimatedMinutes} minutes)`, url: `${origin}/portal/assessments/${a.id}` })),
      tenantId,
      profileId: b.client.id,
    });
    const sentAt = new Date();
    await this.prisma.consultBooking.update({ where: { id: b.id }, data: { clientRecapSentAt: sentAt } });
    return { id: b.id.toString(), sentAt: sentAt.toISOString(), assessments: assigned };
  }

  /** A client's own recap, once it has been sent; never another client's, never a draft. */
  private async ownSent(tenantId: bigint, clientProfileId: bigint, bookingId: bigint) {
    const b = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId, clientProfileId, clientRecapSentAt: { not: null } },
      include: {
        service: { select: { title: true } },
        availability: { select: { startsAt: true, therapist: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
      },
    });
    if (!b) throw new NotFoundException('Recap not found');
    return b;
  }

  /** The recap page in the portal. */
  async forClient(tenantId: bigint, clientProfileId: bigint, bookingId: bigint) {
    const b = await this.ownSent(tenantId, clientProfileId, bookingId);
    const doc = parseRich(b.clientRecap);
    return {
      id: b.id.toString(),
      serviceTitle: b.service.title,
      startsAt: b.availability.startsAt.toISOString(),
      therapistName: fullName(b.availability.therapist?.profile) || 'Your therapist',
      sentAt: b.clientRecapSentAt!.toISOString(),
      // The cleaned document, so the page never meets anything else.
      recap: doc ? JSON.stringify(doc) : '',
      ticks: ticksFor(b.recapTicks, taskStates(doc)),
      assessments: await this.assessments.forSession(tenantId, clientProfileId, b.id),
    };
  }

  /** The client ticking items off. Positions past the recap's last tick-box are refused. */
  async saveTicks(tenantId: bigint, clientProfileId: bigint, bookingId: bigint, raw: unknown) {
    const b = await this.ownSent(tenantId, clientProfileId, bookingId);
    const written = taskStates(parseRich(b.clientRecap));
    if (!Array.isArray(raw) || raw.length > Math.min(written.length, MAX_TICKS) || raw.some((t) => typeof t !== 'boolean')) {
      throw new BadRequestException('Those ticks do not match this recap.');
    }
    await this.prisma.consultBooking.updateMany({
      where: { id: b.id, tenantId, clientProfileId },
      data: { recapTicks: raw as boolean[] },
    });
    return { ticks: ticksFor(raw, written) };
  }
}

/**
 * One tick per tick-box item: the client's own once they have ticked
 * anything, otherwise as the practitioner wrote them. Items added since the
 * client last ticked read as written.
 */
function ticksFor(stored: unknown, written: boolean[]): boolean[] {
  const list = Array.isArray(stored) ? stored : null;
  return written.map((w, i) => (list && typeof list[i] === 'boolean' ? (list[i] as boolean) : w));
}
