import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ConsultService } from './consult.service';

/**
 * SET-06: what a therapist sees clients as, and where. Turning a format off
 * is allowed while future bookings use it — those bookings keep their format
 * and are reported so the practice can contact the clients (rule 8).
 */
const TENANT = 1n;
const PROVIDER = 5n;

function make(therapistOver: Record<string, unknown> = {}) {
  const prisma: any = {
    consultTherapistProfile: {
      findUnique: vi.fn().mockResolvedValue({
        profileId: PROVIDER, tenantId: TENANT, offersOnline: true, offersInPerson: true,
        sessionLengthMinutes: 50, gapMinutes: 10, workLocations: [{ locationId: 4n }],
        profile: { firstName: 'Ada', lastName: null },
        ...therapistOver,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    profile: { update: vi.fn().mockResolvedValue({}) },
    practiceLocation: { findMany: vi.fn().mockResolvedValue([{ id: 4n }, { id: 9n }]) },
    therapistLocation: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), createMany: vi.fn().mockResolvedValue({ count: 1 }), findMany: vi.fn().mockResolvedValue([{ profileId: PROVIDER, locationId: 4n }]) },
    therapistWeeklyTime: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    consultAvailability: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn().mockResolvedValue({ count: 0 }), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    consultBooking: {
      findMany: vi.fn().mockResolvedValue([
        { id: 900n, format: 'IN_PERSON', availability: { startsAt: new Date('2026-10-08T09:00:00Z') }, client: { firstName: 'Ada', lastName: 'Okafor' } },
      ]),
      count: vi.fn().mockResolvedValue(0),
    },
    tenant: { findUnique: vi.fn().mockResolvedValue({ cancellationHours: 24 }), update: vi.fn() },
  };
  const service = new ConsultService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  return { service, prisma };
}

describe('therapist formats', () => {
  it('saves the flags and the working locations', async () => {
    const { service, prisma } = make();
    await service.updateTherapistProfile(TENANT, PROVIDER, { offersOnline: true, offersInPerson: true, locationIds: ['4'] } as any);
    expect(prisma.consultTherapistProfile.update.mock.calls[0][0].data).toMatchObject({ offersOnline: true, offersInPerson: true });
    expect(prisma.therapistLocation.deleteMany).toHaveBeenCalledWith({ where: { profileId: PROVIDER } });
    expect(prisma.therapistLocation.createMany.mock.calls[0][0].data).toEqual([{ profileId: PROVIDER, locationId: 4n }]);
  });

  it('refuses neither format', async () => {
    const { service } = make();
    await expect(service.updateTherapistProfile(TENANT, PROVIDER, { offersOnline: false, offersInPerson: false } as any))
      .rejects.toThrow(BadRequestException);
  });

  it('in person needs at least one of the practice’s active locations', async () => {
    const { service } = make();
    await expect(service.updateTherapistProfile(TENANT, PROVIDER, { offersInPerson: true, locationIds: [] } as any))
      .rejects.toThrow(/location/i);
    await expect(service.updateTherapistProfile(TENANT, PROVIDER, { offersInPerson: true, locationIds: ['77'] } as any))
      .rejects.toThrow(/location/i);
  });

  it('turning in person off reports the future in-person bookings it keeps', async () => {
    const { service, prisma } = make();
    const result: any = await service.updateTherapistProfile(TENANT, PROVIDER, { offersInPerson: false } as any);
    expect(result.affectedBookings).toEqual([
      { id: '900', startsAt: new Date('2026-10-08T09:00:00Z').toISOString(), clientName: 'Ada Okafor', format: 'IN_PERSON' },
    ]);
    // and open in-person times lose in person (regeneration ran)
    expect(prisma.consultAvailability.deleteMany).toHaveBeenCalled();
  });
});
