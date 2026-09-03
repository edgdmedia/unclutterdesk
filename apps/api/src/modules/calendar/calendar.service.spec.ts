import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CalendarService } from './calendar.service';

/**
 * The .ics download is deliberately reachable without a session — a client who
 * books without creating an account still needs it — so the token is the only
 * thing protecting it. The file names the client, the therapist, the service,
 * the appointment time and the video join link, and Jitsi rooms are
 * unauthenticated: that link alone lets a stranger walk into a therapy session.
 * Booking ids are sequential.
 */
function makeService() {
  const prisma: any = { consultBooking: { findUnique: vi.fn() } };
  return { service: new CalendarService(prisma), prisma };
}

const booking = {
  id: 42n,
  videoRoomName: 'unclutterdesk-session-42',
  service: { title: 'Individual Therapy' },
  client: { firstName: 'Ada', lastName: 'Obi', email: 'ada@example.com' },
  availability: {
    startsAt: new Date('2026-10-01T10:00:00Z'),
    endsAt: new Date('2026-10-01T11:00:00Z'),
    therapist: { profile: { firstName: 'Jane', lastName: 'Smith' } },
  },
};

describe('CalendarService.generateIcal', () => {
  let service: CalendarService;
  let prisma: any;

  beforeEach(() => {
    ({ service, prisma } = makeService());
    prisma.consultBooking.findUnique.mockResolvedValue(booking);
  });

  it('returns the calendar entry for a correct token', async () => {
    const ics = await service.generateIcal(42n, CalendarService.icalToken(42n));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('Individual Therapy');
  });

  describe('rejects anything but the right token', () => {
    const bad: [string, string][] = [
      ['no token', ''],
      ['wrong token', 'a'.repeat(32)],
      ['token for a different booking', CalendarService.icalToken(43n)],
      ['truncated token', CalendarService.icalToken(42n).slice(0, 16)],
    ];

    for (const [label, token] of bad) {
      it(label, async () => {
        await expect(service.generateIcal(42n, token)).rejects.toThrow(NotFoundException);
      });
    }

    it('does not read the booking at all when the token is wrong', async () => {
      // Rejecting before the query means a bad token cannot be used to time
      // whether a booking id exists.
      await service.generateIcal(42n, 'nope').catch(() => undefined);
      expect(prisma.consultBooking.findUnique).not.toHaveBeenCalled();
    });

    it('gives the same error for a bad token as for a missing booking', async () => {
      const badToken = await service.generateIcal(42n, 'nope').catch((e) => e.message);
      prisma.consultBooking.findUnique.mockResolvedValue(null);
      const missing = await service
        .generateIcal(42n, CalendarService.icalToken(42n))
        .catch((e) => e.message);
      expect(badToken).toBe(missing);
    });

    it('handles a non-string token without throwing something unexpected', async () => {
      await expect(service.generateIcal(42n, undefined as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('icalToken', () => {
    it('is stable for the same booking', () => {
      expect(CalendarService.icalToken(42n)).toBe(CalendarService.icalToken(42n));
    });

    it('differs between bookings', () => {
      expect(CalendarService.icalToken(42n)).not.toBe(CalendarService.icalToken(43n));
    });

    it('is long enough not to be guessed', () => {
      const token = CalendarService.icalToken(42n);
      expect(token).toMatch(/^[0-9a-f]{32}$/);
    });

    // Sequential ids must not produce related tokens.
    it('shows no relationship between adjacent bookings', () => {
      const a = CalendarService.icalToken(1n);
      const b = CalendarService.icalToken(2n);
      const shared = [...a].filter((ch, i) => ch === b[i]).length;
      expect(shared).toBeLessThan(a.length / 2);
    });
  });
});
