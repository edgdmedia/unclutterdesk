import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ConsultService } from './consult.service';

/**
 * Which service a booking is for, and so what it costs.
 *
 * Weekly availability used to pin every slot to the practice's oldest
 * service, so a service added later never had a bookable time. Slots are now
 * open to any active service, and the client's choice is checked against the
 * practice before its price is charged.
 */
const TENANT = 1n;

function makeService({
  slotService = null as null | { id: bigint; title: string; priceKobo: bigint; durationMinutes: number },
  chosen = { id: 4n, title: 'Couples Session', priceKobo: 0n, durationMinutes: 50 } as any,
  slotMinutes = 50,
} = {}) {
  const startsAt = new Date('2026-10-01T10:00:00Z');
  const tx: any = {
    consultAvailability: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    profile: { findFirst: vi.fn().mockResolvedValue({ id: 5n, email: 'ada@example.com' }), create: vi.fn() },
    consultBooking: { create: vi.fn().mockResolvedValue({ id: 100n }), update: vi.fn() },
    discountCode: { update: vi.fn() },
  };
  const prisma: any = {
    consultAvailability: {
      findFirst: vi.fn().mockResolvedValue({
        id: 3n,
        serviceId: slotService?.id ?? null,
        tenantId: TENANT,
        isActive: true,
        startsAt,
        endsAt: new Date(startsAt.getTime() + slotMinutes * 60_000),
        service: slotService,
        therapist: { videoProvider: 'JITSI', profile: { firstName: 'Jane', lastName: 'Smith' } },
        tenant: { subscriptionTier: 'PRO', name: 'Practice' },
      }),
    },
    consultService: { findFirst: vi.fn().mockResolvedValue(chosen) },
    consultBooking: { count: vi.fn().mockResolvedValue(0) },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
  };
  const service = new ConsultService(
    prisma,
    { notify: vi.fn() } as any,
    { validateDiscount: vi.fn() } as any,
    { calculateSplitPayout: vi.fn() } as any,
    {} as any,
    { pushBookingToGoogle: vi.fn() } as any,
  );
  return { service, prisma, tx };
}

const dto = { availabilityId: '3', serviceId: '4', email: 'ada@example.com', firstName: 'Ada', lastName: 'Obi' };

describe('booking an open slot', () => {
  it('books the service the client chose', async () => {
    const { service, tx } = makeService();
    await service.createBooking(TENANT, dto as any).catch(() => undefined);
    expect(tx.consultBooking.create.mock.calls[0][0].data.serviceId).toBe(4n);
  });

  // The id comes from the request body; the practice comes from the host.
  it('only accepts an active service of this practice', async () => {
    const { service, prisma } = makeService();
    await service.createBooking(TENANT, dto as any).catch(() => undefined);
    expect(prisma.consultService.findFirst.mock.calls[0][0].where).toEqual({ id: 4n, tenantId: TENANT, isActive: true });
  });

  it('refuses a service that is not offered, before claiming the slot', async () => {
    const { service, tx } = makeService({ chosen: null });
    await expect(service.createBooking(TENANT, dto as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.consultAvailability.updateMany).not.toHaveBeenCalled();
  });

  it('refuses a service longer than the slot, so the next slot is not double-booked', async () => {
    const { service, tx } = makeService({
      chosen: { id: 4n, title: 'Couples Session', priceKobo: 0n, durationMinutes: 80 },
    });
    await expect(service.createBooking(TENANT, dto as any)).rejects.toThrow(/too short/);
    expect(tx.consultAvailability.updateMany).not.toHaveBeenCalled();
  });
});

describe('booking a slot that names its service', () => {
  it('keeps the slot\'s service whatever the request says', async () => {
    const pinned = { id: 2n, title: 'Therapy', priceKobo: 0n, durationMinutes: 50 };
    const { service, prisma, tx } = makeService({ slotService: pinned });
    await service.createBooking(TENANT, dto as any).catch(() => undefined);
    expect(prisma.consultService.findFirst).not.toHaveBeenCalled();
    expect(tx.consultBooking.create.mock.calls[0][0].data.serviceId).toBe(2n);
  });
});
