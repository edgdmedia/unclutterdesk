import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LocationsService } from './locations.service';

/**
 * SET-06: the places a practice sees clients. Deactivating one is refused
 * while future in-person sessions still use it (rule 9), and otherwise
 * removes in person from every weekly time and open slot that pointed at it.
 */
const TENANT = 1n;
const OTHER = 2n;

function stored(over: Record<string, unknown> = {}) {
  return {
    id: 5n, tenantId: TENANT, name: 'Lekki clinic', address: '12 Admiralty Way', city: 'Lagos', directions: null, isActive: true,
    createdAt: new Date('2026-10-01'), updatedAt: new Date('2026-10-01'),
    ...over,
  };
}

function make(loc: ReturnType<typeof stored> | null = stored()) {
  const prisma: any = {
    practiceLocation: {
      findMany: vi.fn().mockResolvedValue(loc ? [loc] : []),
      findFirst: vi.fn(async ({ where }: any) => (loc && loc.tenantId === where.tenantId && (where.id === undefined || where.id === loc.id) && (where.isActive === undefined || loc.isActive === where.isActive) ? loc : null)),
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: 6n, isActive: true, directions: null, ...data, createdAt: new Date(), updatedAt: new Date() })),
      update: vi.fn().mockImplementation(async ({ data }: any) => ({ ...loc, ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    therapistLocation: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    therapistWeeklyTime: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    consultAvailability: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), deleteMany: vi.fn().mockResolvedValue({ count: 0 }), findMany: vi.fn().mockResolvedValue([]) },
    consultBooking: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  };
  return { prisma, service: new LocationsService(prisma) };
}

describe('LocationsService', () => {
  it('lists this practice’s locations with a maps link', async () => {
    const { prisma, service } = make();
    const list = await service.list(TENANT);
    expect(prisma.practiceLocation.findMany.mock.calls[0][0].where).toEqual({ tenantId: TENANT });
    expect(list[0]).toMatchObject({ id: '5', name: 'Lekki clinic', mapsUrl: expect.stringContaining('google.com/maps') });
  });

  it('requires the street address', async () => {
    const { service } = make(null);
    await expect(service.create(TENANT, { name: 'Lekki', address: '  ', city: 'Lagos' })).rejects.toThrow('Add the street address.');
  });

  it('refuses a duplicate active name', async () => {
    const { service } = make();
    await expect(service.create(TENANT, { name: 'Lekki clinic', address: '1 Road', city: 'Lagos' })).rejects.toThrow(/already/);
  });

  it('creates with trimmed fields', async () => {
    const { prisma, service } = make(null);
    await service.create(TENANT, { name: '  Lekki clinic  ', address: ' 12 Admiralty Way ', city: ' Lagos ', directions: 'Gate 2' });
    expect(prisma.practiceLocation.create.mock.calls[0][0].data).toMatchObject({ name: 'Lekki clinic', address: '12 Admiralty Way', city: 'Lagos', directions: 'Gate 2' });
  });

  it('refuses to deactivate while future in-person bookings use it', async () => {
    const { prisma, service } = make();
    prisma.consultBooking.findMany.mockResolvedValue([
      { id: 900n, startsAt: new Date('2026-10-09T09:00:00Z'), clientName: 'Ada Okafor' },
    ]);
    prisma.consultBooking.count.mockResolvedValue(3);
    await expect(service.deactivate(TENANT, 5n)).rejects.toThrow(/3 upcoming in-person sessions use Lekki clinic/);
    expect(prisma.practiceLocation.update).not.toHaveBeenCalled();
  });

  it('deactivating removes in person from weekly times and open slots, and says how many', async () => {
    const { prisma, service } = make();
    prisma.consultAvailability.updateMany.mockResolvedValue({ count: 1 });
    const r = await service.deactivate(TENANT, 5n);
    expect(prisma.practiceLocation.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 5n, tenantId: TENANT }, data: { isActive: false } });
    expect(prisma.therapistWeeklyTime.updateMany.mock.calls[0][0].where).toMatchObject({ locationId: 5n });
    expect(prisma.therapistWeeklyTime.updateMany.mock.calls[0][0].data).toMatchObject({ allowsInPerson: false, locationId: null });
    expect(r).toMatchObject({ deactivated: true, changedTimes: 2 });
  });

  it('deletes open slots that allowed only in person', async () => {
    const { prisma, service } = make();
    prisma.consultAvailability.updateMany.mockResolvedValue({ count: 1 });
    await service.deactivate(TENANT, 5n);
    expect(prisma.consultAvailability.deleteMany.mock.calls[0][0].where).toMatchObject({
      locationId: null, allowsInPerson: false, allowsOnline: false, isActive: true,
    });
  });

  it('another practice cannot edit or deactivate it', async () => {
    const { service } = make();
    await expect(service.update(OTHER, 5n, { name: 'Mine now' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deactivate(OTHER, 5n)).rejects.toBeInstanceOf(NotFoundException);
  });
});
