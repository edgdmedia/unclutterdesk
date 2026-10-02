/**
 * VID-01: who spent how long in which session's room. Budgets read these
 * totals; heartbeats keep them current and Daily's webhook corrects them.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const WAT_OFFSET_MS = 60 * 60 * 1000; // Africa/Lagos is UTC+1 all year

export function monthStart(now: Date): Date {
  const wat = new Date(now.getTime() + WAT_OFFSET_MS);
  return new Date(Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth(), 1) - WAT_OFFSET_MS);
}

@Injectable()
export class VideoUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async recordJoin(input: { tenantId: bigint; bookingId: bigint; profileId: bigint; provider: string; role: string }) {
    const recent = await this.prisma.videoParticipant.findFirst({
      where: { tenantId: input.tenantId, bookingId: input.bookingId, profileId: input.profileId, lastSeenAt: { gte: new Date(Date.now() - 2 * 60_000) } },
      orderBy: { joinedAt: 'desc' },
    });
    if (recent) return recent.id;
    const row = await this.prisma.videoParticipant.create({ data: input });
    return row.id;
  }

  async heartbeat(participantId: bigint, profileId: bigint) {
    const row = await this.prisma.videoParticipant.findFirst({ where: { id: participantId, profileId, reconciled: false } });
    if (!row) return;
    const now = new Date();
    await this.prisma.videoParticipant.updateMany({
      where: { id: row.id, reconciled: false },
      data: { lastSeenAt: now, minutes: Math.ceil((now.getTime() - row.joinedAt.getTime()) / 60_000) },
    });
  }

  async dailyMinutesThisMonth(now = new Date()) {
    const r = await this.prisma.videoParticipant.aggregate({ where: { provider: 'DAILY', joinedAt: { gte: monthStart(now) } }, _sum: { minutes: true } });
    return r._sum.minutes ?? 0;
  }

  async jaasUsersThisMonth(now = new Date()) {
    const rows = await this.prisma.videoParticipant.findMany({ where: { provider: 'JAAS', joinedAt: { gte: monthStart(now) } }, distinct: ['profileId'], select: { profileId: true } });
    return rows.length;
  }

  /**
   * Daily's own durations for a room replace the heartbeat estimate. Summed
   * over every meeting in the room, since a dropped call that rejoins starts a
   * new one. Participants are matched on the user_id we put in their token.
   */
  async reconcileDaily(roomName: string): Promise<void> {
    const booking = await this.prisma.consultBooking.findFirst({
      where: { videoRoomName: roomName, videoProvider: 'DAILY' },
      select: { id: true, tenantId: true },
    });
    if (!booking) return;

    const res = await fetch(`https://api.daily.co/v1/meetings?room=${encodeURIComponent(roomName)}`, {
      headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
    });
    if (!res.ok) throw new Error(`Daily /meetings failed: ${res.status}`);
    const meetings = ((await res.json()) as { data?: Array<{ participants?: Array<{ user_id: string | null; duration: number }> }> }).data ?? [];

    const seconds = new Map<string, number>();
    for (const m of meetings) {
      for (const p of m.participants ?? []) {
        if (!p.user_id || !/^\d+$/.test(p.user_id)) continue;
        seconds.set(p.user_id, (seconds.get(p.user_id) ?? 0) + (p.duration ?? 0));
      }
    }
    for (const [userId, total] of seconds) {
      await this.prisma.videoParticipant.updateMany({
        where: { tenantId: booking.tenantId, bookingId: booking.id, profileId: BigInt(userId), provider: 'DAILY' },
        data: { minutes: Math.ceil(total / 60), reconciled: true },
      });
    }
  }

  /** Usage for one calendar month in WAT ('YYYY-MM'), by provider and by practice. */
  async report(month: string) {
    const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
    if (!m) throw new BadRequestException('Month must look like 2026-10.');
    const year = Number(m[1]);
    const index = Number(m[2]) - 1;
    // Mid-month in UTC is inside the same WAT month, so monthStart gives its start.
    const start = monthStart(new Date(Date.UTC(year, index, 15)));
    const next = monthStart(new Date(Date.UTC(year, index + 1, 15)));
    const where = { joinedAt: { gte: start, lt: next } };

    const byProvider = await this.prisma.videoParticipant.groupBy({
      by: ['provider'],
      where,
      _sum: { minutes: true },
      _count: { profileId: true },
      orderBy: { provider: 'asc' },
    });
    const byPractice = await this.prisma.videoParticipant.groupBy({
      by: ['tenantId', 'provider'],
      where,
      _sum: { minutes: true },
      orderBy: [{ tenantId: 'asc' }, { provider: 'asc' }],
    });
    const sessions = await this.prisma.videoParticipant.findMany({
      where,
      distinct: ['tenantId', 'provider', 'bookingId'],
      select: { tenantId: true, provider: true, bookingId: true },
    });
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: [...new Set(byPractice.map((r: { tenantId: bigint }) => r.tenantId))] } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(tenants.map((t: { id: bigint; name: string }) => [t.id.toString(), t.name]));

    return {
      month,
      // The budgets the router works to, so the report can show how much is used.
      limits: {
        dailyMinutes: Number(process.env.VIDEO_DAILY_MONTHLY_MINUTES ?? 9500),
        jaasUsers: Number(process.env.VIDEO_JAAS_MONTHLY_USERS ?? 23),
      },
      totals: byProvider.map((r: any) => ({ provider: r.provider, minutes: r._sum.minutes ?? 0, participants: r._count.profileId })),
      practices: byPractice.map((r: any) => ({
        tenantId: r.tenantId.toString(),
        name: nameOf.get(r.tenantId.toString()) ?? 'Unknown practice',
        provider: r.provider,
        minutes: r._sum.minutes ?? 0,
        sessions: sessions.filter((s: any) => s.tenantId === r.tenantId && s.provider === r.provider).length,
      })),
    };
  }
}
