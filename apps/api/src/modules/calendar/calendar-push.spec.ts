import { describe, expect, it, vi } from 'vitest';
import { CalendarService } from './calendar.service';

/**
 * Keeping a session's Google Calendar event in step with the session.
 *
 * Every push used to insert a new event, so a moved session left its old
 * event (and old Meet link) in both calendars and gained a second one. The
 * booking now remembers its event and whose calendar holds it: a push
 * updates it, a change of practitioner moves it, and a cancelled session's
 * event is removed. Google is the network here; only its client is faked.
 */
const PROVIDER = 6n;

function booking(over: Record<string, any> = {}) {
  return {
    id: 900n,
    status: 'CONFIRMED',
    format: 'ONLINE',
    videoRoomName: null,
    googleEventId: null,
    googleEventOwnerProfileId: null,
    client: { firstName: 'Ada', lastName: 'Ola', email: 'ada@example.com', phone: null },
    service: { title: 'Individual Therapy' },
    location: null,
    tenant: { slug: 'calm', customDomain: null, customDomainStatus: null, subscriptionTier: 'PRO', subscriptionStatus: 'active', complimentaryUntil: null },
    availability: {
      startsAt: new Date('2026-11-20T10:00:00Z'),
      endsAt: new Date('2026-11-20T10:50:00Z'),
      providerProfileId: PROVIDER,
      therapist: { googleRefreshToken: 'rt-6', videoProvider: 'GOOGLE_MEET' },
    },
    ...over,
  };
}

function make(b: any, opts: { patchFails?: number; otherTokens?: Record<string, string | null>; earlier?: any[] } = {}) {
  const events = {
    insert: vi.fn().mockResolvedValue({ data: { id: 'evt-new', hangoutLink: 'https://meet.google.com/new-link' } }),
    patch: vi.fn(async (_args: any) => {
      if (opts.patchFails) throw Object.assign(new Error('gone'), { code: opts.patchFails });
      return { data: { id: b.googleEventId, hangoutLink: b.videoRoomName } };
    }),
    delete: vi.fn().mockResolvedValue({}),
    list: vi.fn().mockResolvedValue({ data: { items: opts.earlier ?? [] } }),
  };
  const prisma: any = {
    consultBooking: {
      findUnique: vi.fn().mockResolvedValue(b),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    consultTherapistProfile: {
      findFirst: vi.fn(async ({ where }: any) => ({ googleRefreshToken: opts.otherTokens?.[String(where.profileId)] ?? null })),
    },
  };
  const service = new CalendarService(prisma);
  const tokens: string[] = [];
  (service as any).calendarApi = vi.fn(async (token: string) => {
    tokens.push(token);
    return { events };
  });
  return { service, prisma, events, tokens };
}

describe('pushing a session to Google Calendar', () => {
  it('makes the event once and remembers it, with whose calendar it is in', async () => {
    const { service, prisma, events } = make(booking());
    await service.pushBookingToGoogle(900n);
    expect(events.insert).toHaveBeenCalledTimes(1);
    expect(prisma.consultBooking.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 900n }, data: expect.objectContaining({ googleEventId: 'evt-new', googleEventOwnerProfileId: PROVIDER, videoRoomName: 'https://meet.google.com/new-link' }) }),
    );
  });

  it('updates the same event when the session moves, never adding a second', async () => {
    const moved = booking({ googleEventId: 'evt-1', googleEventOwnerProfileId: PROVIDER, videoRoomName: 'https://meet.google.com/kept' });
    const { service, events } = make(moved);
    await service.pushBookingToGoogle(900n);
    expect(events.insert).not.toHaveBeenCalled();
    expect(events.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'primary',
        eventId: 'evt-1',
        requestBody: expect.objectContaining({ start: { dateTime: '2026-11-20T10:00:00.000Z' }, end: { dateTime: '2026-11-20T10:50:00.000Z' } }),
      }),
    );
  });

  it('keeps the Meet link: the event, and so its link, is the same one', async () => {
    const moved = booking({ googleEventId: 'evt-1', googleEventOwnerProfileId: PROVIDER, videoRoomName: 'https://meet.google.com/kept' });
    const { service, events, prisma } = make(moved);
    await service.pushBookingToGoogle(900n);
    // No new conference is asked for on an update.
    expect(events.patch.mock.calls[0][0].requestBody).not.toHaveProperty('conferenceData');
    expect(prisma.consultBooking.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ videoRoomName: expect.anything() }) }));
  });

  // Sessions pushed before events were remembered: the first move must not duplicate them.
  it('adopts the event an earlier push made, instead of adding a second', async () => {
    const earlier = [
      { id: 'evt-other', description: 'Booking ID: 9001\nClient: Someone' },
      { id: 'evt-old', description: 'Booking ID: 900\nClient: Ada Ola' },
    ];
    const { service, events, prisma } = make(booking(), { earlier });
    await service.pushBookingToGoogle(900n);
    expect(events.insert).not.toHaveBeenCalled();
    expect(events.patch).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'evt-old' }));
    expect(prisma.consultBooking.update).toHaveBeenCalledWith({ where: { id: 900n }, data: { googleEventId: 'evt-old', googleEventOwnerProfileId: PROVIDER } });
  });

  it('marks new events with the booking, so they are found whatever their text says', async () => {
    const { service, events } = make(booking());
    await service.pushBookingToGoogle(900n);
    expect(events.insert.mock.calls[0][0].requestBody.extendedProperties).toEqual({ private: { unclutterBookingId: '900' } });
  });

  it('makes a new event when the old one was deleted in Google', async () => {
    for (const code of [404, 410]) {
      const { service, events, prisma } = make(booking({ googleEventId: 'evt-1', googleEventOwnerProfileId: PROVIDER }), { patchFails: code });
      await service.pushBookingToGoogle(900n);
      expect(events.insert).toHaveBeenCalledTimes(1);
      expect(prisma.consultBooking.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ googleEventId: 'evt-new' }) }));
    }
  });

  it('moves the event when the session moves to another practitioner', async () => {
    // Taken over from practitioner 77, whose calendar holds the old event.
    const takenOver = booking({ googleEventId: 'evt-77', googleEventOwnerProfileId: 77n });
    const { service, events, tokens } = make(takenOver, { otherTokens: { '77': 'rt-77' } });
    await service.pushBookingToGoogle(900n);
    expect(events.delete).toHaveBeenCalledWith(expect.objectContaining({ calendarId: 'primary', eventId: 'evt-77' }));
    expect(tokens[0]).toBe('rt-77'); // removed with the old owner's credentials
    expect(events.insert).toHaveBeenCalledTimes(1);
    expect(tokens).toContain('rt-6'); // made with the new owner's
  });

  it("removes a cancelled session's event and forgets it", async () => {
    const { service, events, prisma, tokens } = make(booking({ status: 'CANCELLED', googleEventId: 'evt-1', googleEventOwnerProfileId: PROVIDER }));
    await service.pushBookingToGoogle(900n);
    expect(events.delete).toHaveBeenCalledWith(expect.objectContaining({ calendarId: 'primary', eventId: 'evt-1' }));
    expect(tokens).toEqual(['rt-6']);
    expect(events.insert).not.toHaveBeenCalled();
    expect(prisma.consultBooking.updateMany).toHaveBeenCalledWith({ where: { id: 900n, googleEventId: 'evt-1' }, data: { googleEventId: null, googleEventOwnerProfileId: null } });
  });

  it('treats an event already gone as removed', async () => {
    const { service, events, prisma } = make(booking({ status: 'CANCELLED', googleEventId: 'evt-1', googleEventOwnerProfileId: PROVIDER }));
    events.delete.mockRejectedValue(Object.assign(new Error('gone'), { code: 410 }));
    await service.pushBookingToGoogle(900n);
    expect(prisma.consultBooking.updateMany).toHaveBeenCalled();
  });

  it('does nothing for a cancelled session that was never pushed', async () => {
    const { service, events } = make(booking({ status: 'CANCELLED' }));
    await service.pushBookingToGoogle(900n);
    expect(events.insert).not.toHaveBeenCalled();
    expect(events.delete).not.toHaveBeenCalled();
  });

  it('nothing for a session waiting for payment', async () => {
    const { service, events } = make(booking({ status: 'PENDING_PAYMENT' }));
    await service.pushBookingToGoogle(900n);
    expect(events.insert).not.toHaveBeenCalled();
  });

  it('never fails the caller when Google does', async () => {
    const { service, events } = make(booking());
    events.insert.mockRejectedValue(new Error('google down'));
    await expect(service.pushBookingToGoogle(900n)).resolves.toBeUndefined();
  });
});
