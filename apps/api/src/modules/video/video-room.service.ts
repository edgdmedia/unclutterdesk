import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VideoRouter } from './video-router.service';
import { VideoUsageService } from './video-usage.service';
import { JoinCredentials, VideoProvider } from './video-provider';
import { joinWindow } from './join-window';

export type RoomRole = 'THERAPIST' | 'CLIENT' | 'STAFF';
export type JoinResult = JoinCredentials & { participantId: string | null; closesAt: string; role: RoomRole };

const MAX_ATTEMPTS = 3;
const fullName = (p?: { firstName?: string | null; lastName?: string | null } | null) =>
  `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim();
const watTime = (d: Date) =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });

/**
 * VID-01: entering a session's room. Decides who may join and when, makes the
 * booking's room exactly once (on the first join, never at booking), and hands
 * back credentials for whichever provider hosts it.
 */
@Injectable()
export class VideoRoomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly router: VideoRouter,
    private readonly usage: VideoUsageService,
  ) {}

  private load(tenantId: bigint, bookingId: bigint) {
    return this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId },
      include: {
        client: { select: { firstName: true, lastName: true } },
        availability: {
          select: {
            startsAt: true,
            endsAt: true,
            providerProfileId: true,
            therapist: { select: { videoProvider: true, profile: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    }) as Promise<any>;
  }

  async join(
    tenantId: bigint,
    bookingId: bigint,
    caller: { profileId: bigint; canSeeClinical: boolean },
    now = new Date(),
  ): Promise<JoinResult> {
    const booking = await this.load(tenantId, bookingId);
    if (!booking) throw new NotFoundException('Session not found');

    // Rule 2: only the people in the session, or clinical staff. Anyone else
    // isn't told the session exists.
    let role: RoomRole;
    let name: string;
    if (booking.clientProfileId === caller.profileId) {
      role = 'CLIENT';
      name = fullName(booking.client) || 'Client';
    } else if (booking.availability.providerProfileId === caller.profileId) {
      role = 'THERAPIST';
      name = fullName(booking.availability.therapist?.profile) || 'Therapist';
    } else if (caller.canSeeClinical) {
      role = 'STAFF';
      const me = await this.prisma.profile.findFirst({ where: { id: caller.profileId, tenantId }, select: { firstName: true, lastName: true } });
      name = fullName(me) || 'Practice staff';
    } else {
      throw new NotFoundException('Session not found');
    }

    if (booking.status !== 'CONFIRMED') throw new ForbiddenException("This session isn't confirmed yet.");
    if (booking.format === 'IN_PERSON') throw new ForbiddenException('This session is in person, so it has no video room.');

    const window = joinWindow(booking.availability.startsAt, booking.availability.endsAt);
    if (now < window.opensAt) throw new ForbiddenException(`This room opens at ${watTime(window.opensAt)}.`);
    if (now > window.closesAt) throw new ForbiddenException('This session has ended.');
    const closesAt = window.closesAt.toISOString();

    // Rule 5: a therapist on Google Meet uses the Meet link from the calendar event.
    if (booking.availability.therapist?.videoProvider === 'GOOGLE_MEET' && booking.videoRoomName?.startsWith('https://meet.google.com')) {
      return { provider: 'GOOGLE_MEET', url: booking.videoRoomName, participantId: null, closesAt, role };
    }

    const { provider, roomName } = await this.roomFor(booking, tenantId, now, window);
    const credentials = await provider.credentials(roomName, { profileId: caller.profileId, name, owner: role !== 'CLIENT' }, window);
    const participantId = await this.usage.recordJoin({ tenantId, bookingId, profileId: caller.profileId, provider: provider.key, role });
    return { ...credentials, participantId: participantId.toString(), closesAt, role };
  }

  /** Rule 6: the booking's one room, made by whoever arrives first. */
  private async roomFor(booking: any, tenantId: bigint, now: Date, window: { opensAt: Date; closesAt: Date }) {
    if (booking.videoProvider && booking.videoRoomName) {
      return { provider: this.router.byKey(booking.videoProvider), roomName: booking.videoRoomName as string };
    }

    let provider: VideoProvider = await this.router.choose(now);
    let roomName: string | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        roomName = await provider.createRoom(booking.id, window);
        break;
      } catch (err) {
        if (provider.key === 'LINK' || attempt === MAX_ATTEMPTS) throw err;
        provider = this.router.after(provider.key);
      }
    }

    const claimed = await this.prisma.consultBooking.updateMany({
      where: { id: booking.id, tenantId, videoProvider: null },
      data: { videoProvider: provider.key, videoRoomName: roomName },
    });
    if (claimed.count === 1) return { provider, roomName: roomName as string };

    // Someone else made the room a moment earlier: use theirs.
    const winner = await this.load(tenantId, booking.id);
    if (!winner?.videoProvider || !winner.videoRoomName) throw new ForbiddenException('The room could not be prepared. Try again.');
    return { provider: this.router.byKey(winner.videoProvider), roomName: winner.videoRoomName as string };
  }
}
