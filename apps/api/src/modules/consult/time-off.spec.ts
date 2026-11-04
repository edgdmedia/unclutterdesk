import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsultService } from './consult.service';

/**
 * Time off closes the therapist's days to booking. It never cancels a session
 * that is already there: those are listed so the therapist can move them.
 */
const TENANT = 1n;
const PROVIDER = 5n;

const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);
const lagosMorning = (value: string) => new Date(`${value}T08:00:00.000Z`); // 09:00 in Lagos

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma: any = {
    consultAvailability: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    consultBooking: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    consultTherapistProfile: {
      findUnique: vi.fn().mockResolvedValue({
        profileId: PROVIDER,
        tenantId: TENANT,
        offersOnline: true,
        offersInPerson: false,
        sessionLengthMinutes: 50,
        gapMinutes: 0,
        workLocations: [],
        profile: { firstName: 'Ada', lastName: null },
      }),
    },
    therapistWeeklyTime: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    practiceLocation: { findMany: vi.fn().mockResolvedValue([]) },
    tenant: { findUnique: vi.fn().mockResolvedValue({ cancellationHours: 24 }) },
    timeOff: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    ...overrides,
  };
  const service = new ConsultService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  return { service, prisma };
}

const slotRow = (id: bigint, day: string) => ({
  id,
  serviceId: null,
  providerProfileId: PROVIDER,
  channel: 'VIDEO',
  allowsOnline: true,
  allowsInPerson: false,
  locationId: null,
  startsAt: lagosMorning(day),
  endsAt: new Date(lagosMorning(day).getTime() + 50 * 60_000),
  therapist: {
    profile: { firstName: 'Ada', lastName: 'Ola', avatarUrl: null },
    offersOnline: true,
    offersInPerson: false,
    workLocations: [],
  },
  location: null,
});

const bookingRow = (id: bigint, day: string) => ({
  id,
  status: 'CONFIRMED',
  client: { firstName: 'Bisi', lastName: 'Ade' },
  service: { title: 'Individual Therapy' },
  availability: {
    startsAt: lagosMorning(day),
    endsAt: new Date(lagosMorning(day).getTime() + 50 * 60_000),
  },
});

afterEach(() => {
  vi.useRealTimers();
});

describe('time off', () => {
  it('hides open times on a day off from the public booking page', async () => {
    const { service, prisma } = makeService();
    prisma.consultAvailability.findMany.mockResolvedValue([
      slotRow(1n, '2026-11-05'),
      slotRow(2n, '2026-11-06'),
    ]);
    prisma.timeOff.findMany.mockResolvedValue([
      { profileId: PROVIDER, startsOn: dateOnly('2026-11-05'), endsOn: dateOnly('2026-11-05') },
    ]);

    const slots = await service.getPublicAvailability(TENANT, PROVIDER);
    expect(slots.map((s) => s.id)).toEqual(['2']);
  });

  it('closes unbooked open times and keeps a note when time off is added', async () => {
    const { service, prisma } = makeService();
    const created = {
      id: 7n,
      startsOn: dateOnly('2026-11-05'),
      endsOn: dateOnly('2026-11-05'),
      note: 'Conference',
    };
    prisma.timeOff.create.mockResolvedValue(created);
    prisma.consultAvailability.findMany.mockResolvedValue([
      { id: 10n, startsAt: lagosMorning('2026-11-05') },
      { id: 11n, startsAt: lagosMorning('2026-11-06') },
    ]);
    prisma.timeOff.findMany.mockResolvedValue([created]);

    const result = await service.createTimeOff(TENANT, PROVIDER, {
      startsOn: '2026-11-05',
      note: '  Conference  ',
    });

    expect(prisma.timeOff.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT,
        profileId: PROVIDER,
        startsOn: dateOnly('2026-11-05'),
        endsOn: dateOnly('2026-11-05'),
        note: 'Conference',
      },
    });
    expect(prisma.consultAvailability.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [10n] }, tenantId: TENANT, providerProfileId: PROVIDER },
      data: { isActive: false },
    });
    expect(result.created).toEqual({ id: '7', startsOn: '2026-11-05', endsOn: '2026-11-05', note: 'Conference' });
  });

  it('lists sessions already on those days and never cancels them', async () => {
    const { service, prisma } = makeService();
    prisma.timeOff.findMany.mockResolvedValue([
      { id: 7n, startsOn: dateOnly('2026-11-05'), endsOn: dateOnly('2026-11-06'), note: null },
    ]);
    prisma.consultBooking.findMany.mockResolvedValue([
      bookingRow(100n, '2026-11-05'),
      bookingRow(101n, '2026-11-09'),
    ]);

    const result = await service.listTimeOff(TENANT, PROVIDER);

    expect(result.bookings).toHaveLength(1);
    expect(result.bookings[0]).toMatchObject({
      id: '100',
      clientName: 'Bisi Ade',
      serviceTitle: 'Individual Therapy',
      status: 'CONFIRMED',
    });
    expect(prisma.consultBooking.update).not.toHaveBeenCalled();
    expect(prisma.consultBooking.updateMany).not.toHaveBeenCalled();
  });

  it('refuses an open time added on a day off', async () => {
    const { service, prisma } = makeService();
    prisma.timeOff.findMany.mockResolvedValue([
      { startsOn: dateOnly('2026-11-05'), endsOn: dateOnly('2026-11-05') },
    ]);

    await expect(
      service.createAvailabilitySlot(TENANT, PROVIDER, {
        startsAt: lagosMorning('2026-11-05').toISOString(),
        endsAt: new Date(lagosMorning('2026-11-05').getTime() + 50 * 60_000).toISOString(),
      }),
    ).rejects.toThrow(/away on that day/i);
    expect(prisma.consultAvailability.createMany).not.toHaveBeenCalled();
  });

  it('skips those days when regenerating the next four weeks', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-04T10:00:00.000Z')); // Wednesday 4 November, Lagos
    const { service, prisma } = makeService();
    prisma.therapistWeeklyTime.findMany.mockResolvedValue([
      { weekday: 3, start: '09:00', allowsOnline: true, allowsInPerson: false, locationId: null },
    ]);
    prisma.timeOff.findMany.mockResolvedValue([
      { startsOn: dateOnly('2026-11-05'), endsOn: dateOnly('2026-11-05') },
    ]);

    await service.regenerateFromPattern(TENANT, PROVIDER);

    const created = prisma.consultAvailability.createMany.mock.calls[0][0].data as Array<{ startsAt: Date }>;
    const days = created.map((s) => s.startsAt.toISOString().slice(0, 10));
    expect(days).not.toContain('2026-11-05');
    expect(days).toContain('2026-11-12');
  });

  it('removes a period and reopens the pattern', async () => {
    const { service } = makeService();
    const regenerate = vi.spyOn(service, 'regenerateFromPattern').mockResolvedValue(undefined);

    await service.deleteTimeOff(TENANT, PROVIDER, 7n);

    expect(regenerate).toHaveBeenCalledWith(TENANT, PROVIDER);
  });
});