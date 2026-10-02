import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { VideoRoomService } from './video-room.service';
import { VideoRouter } from './video-router.service';
import { joinWindow } from './join-window';

/**
 * VID-01: joining a session's room. Who may join, when, and that a booking
 * gets exactly one room however many people arrive at once.
 */
const TENANT = 1n;
const CLIENT = 5n;
const THERAPIST = 7n;
const STAFF = 9n;
const STARTS = new Date('2026-10-06T09:00:00Z');
const ENDS = new Date('2026-10-06T09:50:00Z');
const DURING = new Date('2026-10-06T09:05:00Z');

const fakeProvider = (key: string, opts: { fail?: boolean } = {}) => ({
  key,
  available: () => true,
  createRoom: opts.fail ? vi.fn().mockRejectedValue(new Error(`${key} down`)) : vi.fn().mockResolvedValue(`${key.toLowerCase()}-room`),
  credentials: vi.fn(async (room: string, _who?: unknown, _window?: unknown) =>
    key === 'DAILY'
      ? { provider: 'DAILY', roomUrl: `https://ud.daily.co/${room}`, token: 't' }
      : key === 'JAAS'
        ? { provider: 'JAAS', appId: 'a', roomName: room, jwt: 'j' }
        : { provider: 'LINK', url: `https://meet.jit.si/${room}` },
  ),
});

function booking(over: Record<string, unknown> = {}) {
  return {
    id: 900n,
    tenantId: TENANT,
    clientProfileId: CLIENT,
    status: 'CONFIRMED',
    format: 'ONLINE',
    videoProvider: null,
    videoRoomName: null,
    client: { firstName: 'Ada', lastName: 'Okafor' },
    availability: {
      startsAt: STARTS,
      endsAt: ENDS,
      providerProfileId: THERAPIST,
      therapist: { videoProvider: 'BUILT_IN', profile: { firstName: 'Sarah', lastName: 'Smith' } },
    },
    ...over,
  };
}

function make(opts: { row?: any; reloaded?: any; claimCount?: number; dailyFails?: boolean } = {}) {
  const daily = fakeProvider('DAILY', { fail: opts.dailyFails });
  const jaas = fakeProvider('JAAS');
  const link = fakeProvider('LINK');
  const usage: any = {
    recordJoin: vi.fn().mockResolvedValue(77n),
    dailyMinutesThisMonth: vi.fn().mockResolvedValue(0),
    jaasUsersThisMonth: vi.fn().mockResolvedValue(0),
  };
  const router = new VideoRouter(usage, [daily, jaas, link] as any);
  vi.spyOn(router, 'choose');
  const findFirst = vi.fn().mockResolvedValueOnce(opts.row === undefined ? booking() : opts.row);
  if (opts.reloaded) findFirst.mockResolvedValueOnce(opts.reloaded);
  const prisma: any = {
    consultBooking: {
      findFirst,
      updateMany: vi.fn().mockResolvedValue({ count: opts.claimCount ?? 1 }),
    },
    profile: { findFirst: vi.fn().mockResolvedValue({ firstName: 'Rita', lastName: 'Admin' }) },
  };
  return { service: new VideoRoomService(prisma, router, usage), prisma, usage, router, daily, jaas, link };
}

describe('VideoRoomService.join', () => {
  it('gives the booking\'s client Daily credentials and a participant id', async () => {
    const { service, usage, daily, prisma } = make();
    const r = await service.join(TENANT, 900n, { profileId: CLIENT, canSeeClinical: false }, DURING);
    expect(r).toMatchObject({ provider: 'DAILY', token: 't', participantId: '77', role: 'CLIENT' });
    expect(r.closesAt).toBe(joinWindow(STARTS, ENDS).closesAt.toISOString());
    expect(prisma.consultBooking.findFirst.mock.calls[0][0].where).toEqual({ id: 900n, tenantId: TENANT });
    expect(daily.credentials.mock.calls[0][1]).toMatchObject({ profileId: CLIENT, name: 'Ada Okafor', owner: false });
    expect(usage.recordJoin).toHaveBeenCalledWith({ tenantId: TENANT, bookingId: 900n, profileId: CLIENT, provider: 'DAILY', role: 'CLIENT' });
  });

  it('makes the therapist the owner', async () => {
    const { service, daily } = make();
    const r = await service.join(TENANT, 900n, { profileId: THERAPIST, canSeeClinical: true }, DURING);
    expect(r.role).toBe('THERAPIST');
    expect(daily.credentials.mock.calls[0][1]).toMatchObject({ name: 'Sarah Smith', owner: true });
  });

  it('lets clinical staff in as owners', async () => {
    const { service, daily } = make();
    const r = await service.join(TENANT, 900n, { profileId: STAFF, canSeeClinical: true }, DURING);
    expect(r.role).toBe('STAFF');
    expect(daily.credentials.mock.calls[0][1]).toMatchObject({ name: 'Rita Admin', owner: true });
  });

  it('hides the booking from a stranger', async () => {
    const { service } = make();
    await expect(service.join(TENANT, 900n, { profileId: 99n, canSeeClinical: false }, DURING)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s for a booking that is not in this practice', async () => {
    const { service } = make({ row: null });
    await expect(service.join(TENANT, 900n, { profileId: CLIENT, canSeeClinical: false }, DURING)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a booking that is not confirmed', async () => {
    const { service } = make({ row: booking({ status: 'PENDING_PAYMENT' }) });
    await expect(service.join(TENANT, 900n, { profileId: CLIENT, canSeeClinical: false }, DURING)).rejects.toThrow(/confirmed/);
  });

  it('refuses an in-person session, which has no video room', async () => {
    const { service } = make({ row: booking({ format: 'IN_PERSON' }) });
    await expect(service.join(TENANT, 900n, { profileId: CLIENT, canSeeClinical: false }, DURING)).rejects.toThrow(/in person/);
  });

  it('says when the room opens, gives no credentials and records nothing, 20 minutes early', async () => {
    const { service, usage, daily } = make();
    const early = service.join(TENANT, 900n, { profileId: CLIENT, canSeeClinical: false }, new Date('2026-10-06T08:40:00Z'));
    await expect(early).rejects.toBeInstanceOf(ForbiddenException);
    await expect(early).rejects.toThrow('This room opens at 9:45 AM.');
    expect(daily.createRoom).not.toHaveBeenCalled();
    expect(usage.recordJoin).not.toHaveBeenCalled();
  });

  it('refuses once the session has ended', async () => {
    const { service } = make();
    await expect(service.join(TENANT, 900n, { profileId: CLIENT, canSeeClinical: false }, new Date('2026-10-06T10:51:00Z'))).rejects.toThrow(/ended/);
  });

  it('reuses the provider and room already made for the booking', async () => {
    const { service, router, jaas, prisma } = make({ row: booking({ videoProvider: 'JAAS', videoRoomName: 'jaas-existing' }) });
    const r = await service.join(TENANT, 900n, { profileId: CLIENT, canSeeClinical: false }, DURING);
    expect(r).toMatchObject({ provider: 'JAAS', roomName: 'jaas-existing' });
    expect(router.choose).not.toHaveBeenCalled();
    expect(jaas.createRoom).not.toHaveBeenCalled();
    expect(prisma.consultBooking.updateMany).not.toHaveBeenCalled();
  });

  it('falls through to JaaS when Daily cannot make a room, and stores JaaS', async () => {
    const { service, prisma } = make({ dailyFails: true });
    const r = await service.join(TENANT, 900n, { profileId: CLIENT, canSeeClinical: false }, DURING);
    expect(r.provider).toBe('JAAS');
    expect(prisma.consultBooking.updateMany).toHaveBeenCalledWith({
      where: { id: 900n, tenantId: TENANT, videoProvider: null },
      data: { videoProvider: 'JAAS', videoRoomName: 'jaas-room' },
    });
  });

  it('uses the winner\'s room when two people make one at the same moment', async () => {
    const winner = booking({ videoProvider: 'JAAS', videoRoomName: 'jaas-winner' });
    const { service, jaas, daily } = make({ claimCount: 0, reloaded: winner });
    const r = await service.join(TENANT, 900n, { profileId: CLIENT, canSeeClinical: false }, DURING);
    expect(daily.createRoom).toHaveBeenCalled();
    expect(r).toMatchObject({ provider: 'JAAS', roomName: 'jaas-winner' });
    expect(jaas.credentials.mock.calls[0][0]).toBe('jaas-winner');
  });

  it('sends a Google Meet therapist\'s session to Meet and records no usage', async () => {
    const row = booking({ videoRoomName: 'https://meet.google.com/abc-defg-hij' });
    (row.availability as any).therapist.videoProvider = 'GOOGLE_MEET';
    const { service, usage } = make({ row });
    const r = await service.join(TENANT, 900n, { profileId: CLIENT, canSeeClinical: false }, DURING);
    expect(r).toEqual(expect.objectContaining({ provider: 'GOOGLE_MEET', url: 'https://meet.google.com/abc-defg-hij', participantId: null }));
    expect(usage.recordJoin).not.toHaveBeenCalled();
  });
});

describe('joinWindow', () => {
  it('opens 15 minutes before the start and closes 60 minutes after the end', () => {
    expect(joinWindow(STARTS, ENDS)).toEqual({ opensAt: new Date('2026-10-06T08:45:00Z'), closesAt: new Date('2026-10-06T10:50:00Z') });
  });
});
