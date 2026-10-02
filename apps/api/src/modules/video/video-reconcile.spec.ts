import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { VideoUsageService } from './video-usage.service';
import { VideoWebhookController } from './video-webhook.controller';
import { verifyDailySignature } from './daily-webhook';

/**
 * VID-01: Daily's own record of who was in a room, and for how long, replaces
 * the heartbeat estimate once a meeting ends.
 */
const SECRET = Buffer.from('daily-webhook-secret').toString('base64');

function signed(body: unknown, secret = SECRET, timestamp = '1760000000') {
  const raw = JSON.stringify(body);
  const signature = createHmac('sha256', Buffer.from(secret, 'base64')).update(`${timestamp}.${raw}`).digest('base64');
  return { rawBody: Buffer.from(raw), headers: { 'x-webhook-signature': signature, 'x-webhook-timestamp': timestamp }, body };
}

beforeEach(() => {
  process.env.DAILY_API_KEY = 'dk';
  process.env.DAILY_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.DAILY_API_KEY;
  delete process.env.DAILY_WEBHOOK_SECRET;
});

function usageWith(rows: Array<{ id: bigint; profileId: bigint }>) {
  const prisma: any = {
    consultBooking: { findFirst: vi.fn().mockResolvedValue({ id: 900n, tenantId: 1n }) },
    videoParticipant: { findMany: vi.fn().mockResolvedValue(rows), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  return { prisma, usage: new VideoUsageService(prisma) };
}

describe('reconcileDaily', () => {
  it("replaces the heartbeat minutes with Daily's durations and marks them reconciled", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { room: 'ud-900-x', participants: [{ user_id: '5', duration: 1000 }, { user_id: '7', duration: 1795 }] },
          // The client dropped and came back: a second meeting in the same room.
          { room: 'ud-900-x', participants: [{ user_id: '5', duration: 810 }] },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { prisma, usage } = usageWith([{ id: 1n, profileId: 5n }, { id: 2n, profileId: 7n }]);

    await usage.reconcileDaily('ud-900-x');

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.daily.co/v1/meetings?room=ud-900-x');
    expect(prisma.consultBooking.findFirst.mock.calls[0][0].where).toEqual({ videoRoomName: 'ud-900-x', videoProvider: 'DAILY' });
    const updates = prisma.videoParticipant.updateMany.mock.calls.map((c: any[]) => c[0]);
    expect(updates).toContainEqual({ where: { tenantId: 1n, bookingId: 900n, profileId: 5n, provider: 'DAILY' }, data: { minutes: 31, reconciled: true } });
    expect(updates).toContainEqual({ where: { tenantId: 1n, bookingId: 900n, profileId: 7n, provider: 'DAILY' }, data: { minutes: 30, reconciled: true } });
  });

  it('ignores a room that belongs to no booking', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { prisma, usage } = usageWith([]);
    prisma.consultBooking.findFirst.mockResolvedValue(null);
    await usage.reconcileDaily('someone-elses-room');
    expect(fetch).not.toHaveBeenCalled();
    expect(prisma.videoParticipant.updateMany).not.toHaveBeenCalled();
  });
});

describe('the Daily webhook', () => {
  const ended = { type: 'meeting.ended', payload: { room: 'ud-900-x' } };

  it('accepts a correctly signed meeting.ended and reconciles that room', async () => {
    const usage: any = { reconcileDaily: vi.fn().mockResolvedValue(undefined) };
    const controller = new VideoWebhookController(usage);
    await expect(controller.daily(signed(ended) as any)).resolves.toEqual({ ok: true });
    expect(usage.reconcileDaily).toHaveBeenCalledWith('ud-900-x');
  });

  it('refuses a bad signature and changes nothing', async () => {
    const usage: any = { reconcileDaily: vi.fn() };
    const controller = new VideoWebhookController(usage);
    const forged = signed(ended, Buffer.from('not-the-secret').toString('base64'));
    await expect(controller.daily(forged as any)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usage.reconcileDaily).not.toHaveBeenCalled();
  });

  it("answers Daily's set-up check without reconciling anything", async () => {
    const usage: any = { reconcileDaily: vi.fn() };
    const controller = new VideoWebhookController(usage);
    await expect(controller.daily(signed({ test: 'test' }) as any)).resolves.toEqual({ ok: true });
    expect(usage.reconcileDaily).not.toHaveBeenCalled();
  });

  it('ignores every event while no webhook secret is configured', async () => {
    delete process.env.DAILY_WEBHOOK_SECRET;
    const usage: any = { reconcileDaily: vi.fn() };
    const controller = new VideoWebhookController(usage);
    await expect(controller.daily(signed(ended) as any)).resolves.toEqual({ ok: true });
    expect(usage.reconcileDaily).not.toHaveBeenCalled();
  });
});

describe('verifyDailySignature', () => {
  it('rejects a missing signature or timestamp', () => {
    expect(verifyDailySignature(SECRET, undefined, '1', Buffer.from('{}'))).toBe(false);
    expect(verifyDailySignature(SECRET, 'x', undefined, Buffer.from('{}'))).toBe(false);
  });
});
