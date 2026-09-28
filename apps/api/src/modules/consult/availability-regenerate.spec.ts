import { describe, expect, it, vi } from 'vitest';
import { ConsultService } from './consult.service';

/**
 * Saving working hours regenerates the next four weeks of open slots.
 *
 * It deleted only unbooked slots and then created a slot for every window,
 * so a booked 10:00 session got a fresh, bookable 10:00 slot beside it and a
 * second client could take the same hour. Staff custom times, which can sit
 * anywhere in the day, made that more likely.
 */
const TENANT = 1n;
const PROVIDER = 5n;

const HOURS = {
  days: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, enabled: true, windows: [{ start: '09:00', end: '12:00' }] })),
  sessionLengthMinutes: 60,
  gapMinutes: 0,
};

function makeService(booked: Array<{ startsAt: Date; endsAt: Date }> = []) {
  const prisma: any = {
    consultAvailability: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    consultBooking: { findMany: vi.fn().mockResolvedValue(booked.map((availability) => ({ availability }))) },
    tenant: { findUnique: vi.fn().mockResolvedValue({ cancellationHours: 24 }), update: vi.fn() },
  };
  const service = new ConsultService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  return { service, prisma };
}

const created = (prisma: any): Array<{ startsAt: Date; endsAt: Date }> =>
  prisma.consultAvailability.createMany.mock.calls[0]?.[0].data ?? [];

describe('regenerating open slots', () => {
  it('does not open a slot over a booked session', async () => {
    const first = makeService();
    await first.service.replaceTherapistAvailability(TENANT, PROVIDER, HOURS);
    const all = created(first.prisma);
    const taken = all[3];

    const { service, prisma } = makeService([taken]);
    await service.replaceTherapistAvailability(TENANT, PROVIDER, HOURS);
    const slots = created(prisma);

    expect(slots).toHaveLength(all.length - 1);
    expect(slots.some((s) => s.startsAt.getTime() === taken.startsAt.getTime())).toBe(false);
  });

  it('also skips slots that only partly overlap a session, such as a custom 10:30 time', async () => {
    const first = makeService();
    await first.service.replaceTherapistAvailability(TENANT, PROVIDER, HOURS);
    const slot = created(first.prisma)[1];
    const custom = {
      startsAt: new Date(slot.startsAt.getTime() + 30 * 60_000),
      endsAt: new Date(slot.startsAt.getTime() + 80 * 60_000),
    };

    const { service, prisma } = makeService([custom]);
    await service.replaceTherapistAvailability(TENANT, PROVIDER, HOURS);
    const overlapping = created(prisma).filter((s) => s.startsAt < custom.endsAt && s.endsAt > custom.startsAt);
    expect(overlapping).toEqual([]);
  });

  it('looks only at this practitioner’s sessions that are still going ahead', async () => {
    const { service, prisma } = makeService();
    await service.replaceTherapistAvailability(TENANT, PROVIDER, HOURS);
    expect(prisma.consultBooking.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: TENANT,
      status: { not: 'CANCELLED' },
      availability: { providerProfileId: PROVIDER },
    });
  });
});

describe('open times offered for a service', () => {
  const start = new Date(Date.now() + 3 * 86_400_000);
  const slot = (id: bigint, minutes: number) => ({
    id, serviceId: null, providerProfileId: PROVIDER, channel: 'VIDEO',
    startsAt: start, endsAt: new Date(start.getTime() + minutes * 60_000),
    therapist: { profile: { firstName: 'Jane', lastName: 'Smith', avatarUrl: null } },
  });

  it('leaves out times too short for the chosen service', async () => {
    const { service, prisma } = makeService();
    prisma.consultAvailability.findMany.mockResolvedValue([slot(1n, 30), slot(2n, 60)]);
    prisma.consultService = { findFirst: vi.fn().mockResolvedValue({ durationMinutes: 50 }) };
    const slots = await service.getPublicAvailability(TENANT, PROVIDER, 20n);
    expect(slots.map((s) => s.id)).toEqual(['2']);
  });

  it('offers every time when no service is chosen', async () => {
    const { service, prisma } = makeService();
    prisma.consultAvailability.findMany.mockResolvedValue([slot(1n, 30), slot(2n, 60)]);
    const slots = await service.getPublicAvailability(TENANT);
    expect(slots).toHaveLength(2);
  });
});
