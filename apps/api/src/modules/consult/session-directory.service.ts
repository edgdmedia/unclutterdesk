import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { chargedKobo } from '../../common/revenue';
import { tenantWebOrigin } from '../../common/origins';

export interface SessionActor {
  profileId: bigint;
  viewAll: boolean;
  clinical?: boolean;
  desk?: boolean;
}

const name = (p: { firstName?: string | null; lastName?: string | null } | null | undefined, fallback = 'Client') =>
  `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || fallback;

const roomLink = (roomName: string | null) =>
  !roomName ? null : roomName.startsWith('http') ? roomName : `https://meet.jit.si/${roomName}`;

/**
 * The practice's session register and the single-session view: the same rows
 * the schedule feed shows, but scoped by permission rather than by one
 * practitioner's diary, and joined with what the session page needs.
 */
@Injectable()
export class SessionDirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  private include() {
    return {
      client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      service: { select: { title: true } },
      availability: { include: { therapist: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
      clinicalNotes: { select: { id: true, isLocked: true }, take: 1, orderBy: { createdAt: 'desc' as const } },
    };
  }

  private shape(b: any, bookedBy: string | null) {
    return {
      id: b.id.toString(),
      startsAt: b.availability.startsAt.toISOString(),
      endsAt: b.availability.endsAt.toISOString(),
      status: b.status as string,
      paymentMethod: b.paymentMethod as string,
      amountKobo: b.amountKobo !== null && b.amountKobo !== undefined ? String(b.amountKobo) : null,
      holdExpiresAt: b.holdExpiresAt ? b.holdExpiresAt.toISOString() : null,
      bookedBy,
      client: { id: b.client.id.toString(), name: name(b.client) },
      serviceTitle: b.service.title,
      provider: {
        id: b.availability.providerProfileId?.toString?.() ?? '',
        name: name(b.availability.therapist?.profile, 'Practitioner'),
      },
      channel: b.availability.channel as string,
    };
  }

  private async bookedBy(tenantId: bigint, createdByProfileId: bigint | null): Promise<string | null> {
    if (!createdByProfileId) return null;
    const creator = await this.prisma.profile.findFirst({
      where: { id: createdByProfileId, tenantId },
      select: { firstName: true, lastName: true },
    });
    return name(creator, 'Staff');
  }

  async listSessions(
    tenantId: bigint,
    actor: SessionActor,
    q: { status?: 'upcoming' | 'past' | 'all'; providerProfileId?: bigint; search?: string } = {},
  ) {
    const now = new Date();
    const where: any = { tenantId };
    where.availability = actor.viewAll
      ? q.providerProfileId ? { providerProfileId: q.providerProfileId } : {}
      : { providerProfileId: actor.profileId };
    if (q.status === 'upcoming') {
      where.availability.startsAt = { gte: now };
      where.status = { not: 'CANCELLED' };
    } else if (q.status === 'past') {
      where.availability.startsAt = { lt: now };
    }
    const s = q.search?.trim().toLowerCase();
    if (s) {
      where.OR = [
        { client: { firstName: { contains: s, mode: 'insensitive' } } },
        { client: { lastName: { contains: s, mode: 'insensitive' } } },
        { client: { email: { contains: s, mode: 'insensitive' } } },
        { service: { title: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.consultBooking.findMany({
      where,
      include: this.include(),
      orderBy: { availability: { startsAt: q.status === 'past' ? 'desc' : 'asc' } },
      take: 500,
    });

    const out = [];
    for (const b of rows) out.push(this.shape(b, await this.bookedBy(tenantId, b.createdByProfileId)));
    return out;
  }

  async getSession(tenantId: bigint, actor: SessionActor, bookingId: bigint) {
    const b = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId, ...(actor.viewAll ? {} : { availability: { providerProfileId: actor.profileId } }) },
      include: this.include(),
    });
    if (!b) throw new NotFoundException('Session not found');
    const note = b.clinicalNotes[0];
    return {
      ...this.shape(b, await this.bookedBy(tenantId, b.createdByProfileId)),
      clientEmail: b.client.email,
      clientPhone: b.client.phone,
      videoRoomLink: b.availability.channel === 'VIDEO' ? roomLink(b.videoRoomName) : null,
      note: note ? { id: note.id.toString(), status: note.isLocked ? 'COMPLETED' : 'DRAFT' } : null,
      internalSummary: b.internalSummary,
      clientRecap: b.clientRecap,
      clientRecapSentAt: b.clientRecapSentAt ? b.clientRecapSentAt.toISOString() : null,
      can: {
        edit: actor.viewAll === true,
        summary: actor.clinical === true,
        markPaid: actor.desk === true,
      },
    };
  }
}
