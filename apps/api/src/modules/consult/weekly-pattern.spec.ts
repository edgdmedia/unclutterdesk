import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ConsultService } from './consult.service';

/**
 * SET-06: the weekly pattern is stored data, and each time carries its own
 * formats. Saving it regenerates open slots; booked sessions and one-off
 * changes survive untouched.
 */
const TENANT = 1n;
const PROVIDER = 5n;

function make(opts: {
  therapist?: Record<string, unknown> | null;
  weekly?: any[];
  keptSlots?: any[];
} = {}) {
  const therapist = opts.therapist === null ? null : {
    profileId: PROVIDER, tenantId: TENANT, offersOnline: true, offersInPerson: false,
    sessionLengthMinutes: 50, gapMinutes: 10, workLocations: [],
    profile: { firstName: 'Ada', lastName: null },
    ...(opts.therapist ?? {}),
  };
  const storedWeekly: any[] = [...(opts.weekly ?? [])];
  const prisma: any = {
    consultTherapistProfile: {
      findUnique: vi.fn().mockResolvedValue(therapist),
      update: vi.fn().mockImplementation(async ({ data }: any) => ({ ...therapist, ...data })),
    },
    therapistWeeklyTime: {
      findMany: vi.fn(async () => storedWeekly),
      deleteMany: vi.fn(async () => { storedWeekly.length = 0; return { count: 0 }; }),
      createMany: vi.fn(async ({ data }: any) => { storedWeekly.push(...data); return { count: data.length }; }),
    },
    practiceLocation: { findMany: vi.fn().mockResolvedValue([]) },
    consultAvailability: {
      findMany: vi.fn().mockResolvedValue(opts.keptSlots ?? []),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    consultBooking: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    tenant: { findUnique: vi.fn().mockResolvedValue({ cancellationHours: 24 }), update: vi.fn() },
  };
  const service = new ConsultService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  return { service, prisma };
}

const created = (prisma: any) => prisma.consultAvailability.createMany.mock.calls[0]?.[0].data ?? [];

describe('saving the weekly pattern', () => {
  it('stores the times and returns them from GET', async () => {
    const weekly = [{ id: 1n, tenantId: TENANT, profileId: PROVIDER, weekday: 0, start: '09:00', allowsOnline: true, allowsInPerson: false, locationId: null }];
    const { service, prisma } = make({ weekly });
    await service.replaceTherapistAvailability(TENANT, PROVIDER, {
      weeklyTimes: [{ weekday: 0, start: '09:00', formats: ['ONLINE'] }],
      sessionLengthMinutes: 50, gapMinutes: 10,
    } as any);
    expect(prisma.therapistWeeklyTime.createMany.mock.calls[0][0].data).toEqual([
      { tenantId: TENANT, profileId: PROVIDER, weekday: 0, start: '09:00', allowsOnline: true, allowsInPerson: false, locationId: null },
    ]);
    const view = await service.getTherapistAvailability(TENANT, PROVIDER);
    expect(view.weeklyTimes).toEqual([{ weekday: 0, start: '09:00', formats: ['ONLINE'], locationId: null }]);
    expect(view.sessionLengthMinutes).toBe(50);
  });

  it('Mon 09:00 online and 10:00 either at Lekki produce slots with exactly those formats', async () => {
    const { service, prisma } = make({
      therapist: { offersOnline: true, offersInPerson: true, workLocations: [{ locationId: 4n }] },
    });
    prisma.practiceLocation.findMany.mockResolvedValue([{ id: 4n }]);
    vi.useFakeTimers().setSystemTime(new Date('2026-10-05T12:00:00Z')); // Mon noon WAT
    await service.replaceTherapistAvailability(TENANT, PROVIDER, {
      weeklyTimes: [
        { weekday: 0, start: '09:00', formats: ['ONLINE'] },
        { weekday: 0, start: '10:00', formats: ['ONLINE', 'IN_PERSON'], locationId: '4' },
      ],
      sessionLengthMinutes: 50, gapMinutes: 10,
    } as any);
    const slots = created(prisma);
    // Four Mondays in the 28-day horizon, each with its two times.
    expect(slots).toHaveLength(8);
    expect(slots.slice(0, 2).map((s: any) => [s.startsAt.toISOString(), s.allowsOnline, s.allowsInPerson, s.locationId])).toEqual([
      ['2026-10-12T08:00:00.000Z', true, false, null],
      ['2026-10-12T09:00:00.000Z', true, true, 4n],
    ]);
    expect(slots[1].channel).toBe('IN_PERSON');
    expect(slots.every((s: any) => s.startsAt.toISOString().endsWith('T08:00:00.000Z') || s.startsAt.toISOString().endsWith('T09:00:00.000Z'))).toBe(true);
    vi.useRealTimers();
  });

  it('an online-only therapist saving an in-person time gets a named, timeled 400', async () => {
    const { service } = make();
    await expect(
      service.replaceTherapistAvailability(TENANT, PROVIDER, {
        weeklyTimes: [{ weekday: 1, start: '10:00', formats: ['IN_PERSON'], locationId: '1' }],
        sessionLengthMinutes: 50, gapMinutes: 10,
      } as any),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.replaceTherapistAvailability(TENANT, PROVIDER, {
        weeklyTimes: [{ weekday: 1, start: '10:00', formats: ['IN_PERSON'], locationId: '1' }],
        sessionLengthMinutes: 50, gapMinutes: 10,
      } as any),
    ).rejects.toThrow('Tue 10:00: Ada only works online. Turn on in-person for Ada first.');
  });

  it('the old days/windows body still works and yields online slots', async () => {
    const { service, prisma } = make();
    vi.useFakeTimers().setSystemTime(new Date('2026-10-05T12:00:00Z'));
    await service.replaceTherapistAvailability(TENANT, PROVIDER, {
      days: [{ day: 0, enabled: true, windows: [{ start: '09:00', end: '11:00' }] }],
      sessionLengthMinutes: 50, gapMinutes: 10,
    } as any);
    const stored = prisma.therapistWeeklyTime.createMany.mock.calls[0][0].data;
    expect(stored.map((t: any) => t.start)).toEqual(['09:00', '10:00']);
    expect(stored.every((t: any) => t.allowsOnline && !t.allowsInPerson)).toBe(true);
    vi.useRealTimers();
  });
});
