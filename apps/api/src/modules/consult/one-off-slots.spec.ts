import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConsultService } from './consult.service';

/**
 * SET-06: one-off changes to upcoming times. A change marks the slot
 * `customised` so a later pattern save keeps it; "Back to weekly" deletes the
 * row and lets the pattern's version come back; booked times are locked.
 */
const TENANT = 1n;
const PROVIDER = 5n;

function slot(over: Record<string, unknown> = {}) {
  return {
    id: 30n, tenantId: TENANT, providerProfileId: PROVIDER, startsAt: new Date('2026-10-08T08:00:00Z'),
    endsAt: new Date('2026-10-08T08:50:00Z'), allowsOnline: true, allowsInPerson: false, locationId: null,
    customised: false, isActive: true, ...over,
  };
}

function make(s: Record<string, unknown> | null, bookedCount = 0) {
  const prisma: any = {
    consultAvailability: {
      findFirst: vi.fn().mockResolvedValue(s),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    consultBooking: { count: vi.fn().mockResolvedValue(bookedCount) },
    consultTherapistProfile: {
      findUnique: vi.fn().mockResolvedValue({ profileId: PROVIDER, offersOnline: true, offersInPerson: true, sessionLengthMinutes: 50, gapMinutes: 10, workLocations: [{ locationId: 4n }], profile: { firstName: 'Ada', lastName: null } }),
      update: vi.fn(),
    },
    practiceLocation: { findMany: vi.fn().mockResolvedValue([{ id: 4n }]) },
    therapistWeeklyTime: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn(), createMany: vi.fn() },
    tenant: { findUnique: vi.fn().mockResolvedValue({ cancellationHours: 24 }), update: vi.fn() },
  };
  const service = new ConsultService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  return { service, prisma };
}

describe('one-off slot changes', () => {
  it('marks the slot customised with its new formats', async () => {
    const { service, prisma } = make(slot());
    await service.updateSlot(TENANT, PROVIDER, 30n, { formats: ['ONLINE', 'IN_PERSON'], locationId: '4' });
    expect(prisma.consultAvailability.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 30n, tenantId: TENANT, providerProfileId: PROVIDER },
      data: { allowsOnline: true, allowsInPerson: true, locationId: 4n, customised: true },
    });
  });

  it('refuses a booked time', async () => {
    const { service } = make(slot(), 1);
    await expect(service.updateSlot(TENANT, PROVIDER, 30n, { formats: ['ONLINE'] })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.updateSlot(TENANT, PROVIDER, 30n, { formats: ['ONLINE'] })).rejects.toThrow(/booked/);
  });

  it('reset deletes the row and regenerates from the pattern', async () => {
    const { service, prisma } = make(slot({ customised: true }));
    await service.updateSlot(TENANT, PROVIDER, 30n, { reset: true });
    expect(prisma.consultAvailability.deleteMany).toHaveBeenCalledWith({ where: { id: 30n, tenantId: TENANT, providerProfileId: PROVIDER } });
    expect(prisma.consultAvailability.deleteMany).toHaveBeenCalled();
  });

  it('validates the new formats like a weekly time', async () => {
    const { service } = make(slot());
    await expect(service.updateSlot(TENANT, PROVIDER, 30n, { formats: [] })).rejects.toThrow(BadRequestException);
  });

  it('another practitioner’s slot is not found', async () => {
    const { service, prisma } = make(slot());
    prisma.consultAvailability.findFirst.mockResolvedValue(null);
    await expect(service.updateSlot(TENANT, PROVIDER, 30n, { formats: ['ONLINE'] })).rejects.toBeInstanceOf(NotFoundException);
  });
});
