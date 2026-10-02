import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ConsultService } from './consult.service';

/**
 * One slot, one booking.
 *
 * The availability check runs outside the transaction, so two concurrent
 * requests both pass it. The slot was then deactivated with an unconditional
 * `update`, so both succeeded: one time slot carried two bookings and two
 * payment attempts, and two clients arrived for the same appointment.
 *
 * The claim is now an `updateMany` whose WHERE still requires `isActive: true`.
 * Postgres evaluates that predicate while holding the row lock, so the second
 * transaction waits for the first to commit and then matches nothing.
 */
const TENANT = 1n;

function makeService({ claimCount = 1 }: { claimCount?: number } = {}) {
  const tx: any = {
    consultAvailability: {
      updateMany: vi.fn().mockResolvedValue({ count: claimCount }),
      update: vi.fn(),
    },
    profile: {
      findFirst: vi.fn().mockResolvedValue({ id: 5n, email: 'ada@example.com' }),
      create: vi.fn(),
    },
    consultBooking: { create: vi.fn().mockResolvedValue({ id: 100n }), update: vi.fn() },
    discountCode: { update: vi.fn() },
  };

  const prisma: any = {
    consultAvailability: {
      findFirst: vi.fn().mockResolvedValue({
        id: 3n,
        serviceId: 2n,
        tenantId: TENANT,
        isActive: true,
        startsAt: new Date('2026-10-01T10:00:00Z'),
        service: { id: 2n, title: 'Therapy', priceKobo: 0n },
        therapist: { videoProvider: 'JITSI', profile: { firstName: 'Jane', lastName: 'Smith' } },
        tenant: { subscriptionTier: 'PRO', name: 'Practice' },
      }),
    },
    consultBooking: { count: vi.fn().mockResolvedValue(0) },
    profile: { findFirst: vi.fn().mockResolvedValue({ id: 5n, email: 'ada@example.com', firstName: 'Ada', lastName: 'Obi', phone: '080' }) },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
  };

  const service = new ConsultService(
    prisma,
    { notify: vi.fn(), sendEmail: vi.fn().mockResolvedValue({ success: true }) } as any,
    { validateDiscount: vi.fn() } as any,
    { calculateSplitPayout: vi.fn() } as any,
    {} as any,
    { pushBookingToGoogle: vi.fn() } as any, {} as any,
  );
  return { service, prisma, tx };
}

const dto = {
  availabilityId: '3',
  serviceId: '2',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Obi',
  phone: '080',
};

describe('booking a slot', () => {
  let service: ConsultService;
  let tx: any;

  beforeEach(() => {
    ({ service, tx } = makeService());
  });

  it('claims the slot with the condition in the update', async () => {
    await service.createBooking(TENANT, 5n, dto as any).catch(() => undefined);

    expect(tx.consultAvailability.updateMany).toHaveBeenCalledWith({
      where: { id: 3n, tenantId: TENANT, isActive: true },
      data: { isActive: false },
    });
  });

  it('never deactivates the slot unconditionally', async () => {
    await service.createBooking(TENANT, 5n, dto as any).catch(() => undefined);
    // An unconditional update is what let both racers win.
    expect(tx.consultAvailability.update).not.toHaveBeenCalled();
  });

  it('claims the slot before writing the booking', async () => {
    const order: string[] = [];
    tx.consultAvailability.updateMany.mockImplementation(async () => {
      order.push('claim');
      return { count: 1 };
    });
    tx.consultBooking.create.mockImplementation(async () => {
      order.push('booking');
      return { id: 100n };
    });

    await service.createBooking(TENANT, 5n, dto as any).catch(() => undefined);
    expect(order).toEqual(['claim', 'booking']);
  });

  describe('when another request claimed it first', () => {
    beforeEach(() => {
      ({ service, tx } = makeService({ claimCount: 0 }));
    });

    it('rejects the booking', async () => {
      await expect(service.createBooking(TENANT, 5n, dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('writes no booking at all', async () => {
      await service.createBooking(TENANT, 5n, dto as any).catch(() => undefined);
      expect(tx.consultBooking.create).not.toHaveBeenCalled();
    });

    it('does not consume a discount code', async () => {
      await service
        .createBooking(TENANT, 5n, { ...dto, discountCode: 'SAVE10' } as any)
        .catch(() => undefined);
      expect(tx.discountCode.update).not.toHaveBeenCalled();
    });
  });
});

describe('video rooms at booking', () => {
  /**
   * VID-01: rooms are made on the first join, by the video router, so booking
   * stores no room and returns no provider link. The room names themselves
   * are random (providers.spec.ts).
   */
  it('makes no room and returns no meet.jit.si link', async () => {
    const { service, tx } = makeService();
    const result: any = await service.createBooking(TENANT, 5n, dto as any).catch(() => null);
    const data = tx.consultBooking.create.mock.calls[0]?.[0]?.data ?? {};
    expect(data.videoRoomName ?? null).toBeNull();
    if (result) expect(result).not.toHaveProperty('videoRoomLink');
    expect(JSON.stringify(result ?? {}, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toMatch(/meet\.jit\.si/);
  });
});
