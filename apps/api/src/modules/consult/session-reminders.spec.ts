import { describe, expect, it, vi } from 'vitest';
import { SessionReminderService, dueReminder } from './session-reminders.service';

/**
 * NOT-07: sessions are reminded 24 hours and 1 hour before, with the join
 * link (the Google Meet link once the calendar made it) or the address.
 */
const HOUR = 3_600_000;
const NOW = new Date('2026-11-05T12:00:00Z');
const inH = (h: number) => new Date(NOW.getTime() + h * HOUR);

describe('dueReminder', () => {
  it('the 24-hour reminder once a day is left, for a session booked before then', () => {
    expect(dueReminder({ startsAt: inH(23.9), createdAt: inH(-72) }, NOW)).toBe('24h');
  });
  it('the 1-hour reminder in the last hour, instead of the 24-hour one', () => {
    expect(dueReminder({ startsAt: inH(0.9), createdAt: inH(-72) }, NOW)).toBe('1h');
  });
  it("no 'tomorrow' email for a session booked today, but its 1-hour reminder still comes", () => {
    // Booked at 10:00 for 20:00 (8 hours ahead now).
    expect(dueReminder({ startsAt: inH(8), createdAt: inH(-2) }, NOW)).toBeNull();
    expect(dueReminder({ startsAt: inH(0.9), createdAt: inH(-9) }, NOW)).toBe('1h');
  });
  it('nothing for a session booked inside its last hour, more than a day ahead, or already started', () => {
    expect(dueReminder({ startsAt: inH(0.5), createdAt: inH(-0.2) }, NOW)).toBeNull();
    expect(dueReminder({ startsAt: inH(30), createdAt: inH(-72) }, NOW)).toBeNull();
    expect(dueReminder({ startsAt: inH(-0.1), createdAt: inH(-72) }, NOW)).toBeNull();
  });
});

function setup(rows: any[]) {
  const prisma: any = { consultBooking: { findMany: vi.fn().mockResolvedValue(rows) } };
  const notifications: any = { queueReminder: vi.fn().mockResolvedValue(1n) };
  return { prisma, notifications, service: new SessionReminderService(prisma, notifications) };
}

const row = (over: Record<string, any> = {}) => ({
  id: 900n,
  tenantId: 1n,
  createdAt: inH(-72),
  format: 'ONLINE',
  videoRoomName: 'https://meet.google.com/abc-defg-hij',
  client: { id: 40n, email: 'ada@example.com', timezone: 'Africa/Lagos' },
  service: { title: 'Individual Session' },
  tenant: { name: 'Calm Practice', slug: 'calm', customDomain: null, customDomainStatus: null },
  location: null,
  availability: { startsAt: inH(0.9), therapist: { profile: { firstName: 'Segun', lastName: 'Ade' } } },
  ...over,
});

describe('SessionReminderService.run', () => {
  it('queues the reminder with the Meet link, for email and in-app, once per session time', async () => {
    const { service, notifications } = setup([row()]);
    expect(await service.run(NOW)).toBe(1);
    const [input, key] = notifications.queueReminder.mock.calls[0];
    expect(key).toBe(`session-reminder:1h:900:${inH(0.9).getTime()}`);
    expect(input).toMatchObject({
      profileId: 40n,
      type: 'consult.session_reminder_1h',
      link: 'https://meet.google.com/abc-defg-hij',
      actionLabel: 'Join the session',
      channels: { email: true, in_app: true },
    });
    expect(input.message).toContain('Individual Session with Segun Ade is in an hour');
    expect(input.message).toContain('Join here: https://meet.google.com/abc-defg-hij');
  });

  it("uses the app's room when there is no Meet link, and the address in person", async () => {
    const { service, notifications } = setup([
      row({ id: 901n, videoRoomName: null }),
      row({ id: 902n, format: 'IN_PERSON', location: { name: 'Lekki clinic', address: '4 Admiralty Way', city: 'Lagos' } }),
    ]);
    await service.run(NOW);
    const [online, inPerson] = notifications.queueReminder.mock.calls.map((c: any[]) => c[0]);
    expect(online.link).toContain('/901');
    expect(inPerson.message).toContain('in person at Lekki clinic, 4 Admiralty Way, Lagos');
    expect(inPerson.actionLabel).toBe('View my booking');
  });

  it('only looks at confirmed sessions in the next day, and skips ones not due', async () => {
    const { service, prisma, notifications } = setup([row({ availability: { startsAt: inH(8), therapist: null }, createdAt: inH(-2) })]);
    expect(await service.run(NOW)).toBe(0);
    expect(prisma.consultBooking.findMany.mock.calls[0][0].where).toMatchObject({ status: 'CONFIRMED' });
    expect(notifications.queueReminder).not.toHaveBeenCalled();
  });

  it('one failure does not stop the others', async () => {
    const { service, notifications } = setup([row({ id: 1n }), row({ id: 2n })]);
    notifications.queueReminder.mockRejectedValueOnce(new Error('db')).mockResolvedValue(1n);
    expect(await service.run(NOW)).toBe(1);
  });
});
