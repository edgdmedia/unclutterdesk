import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConsultService } from './consult.service';

/**
 * Moving a booking to another slot.
 *
 * Two slots change hands at once, so the same hazards as the original booking
 * apply and one more: the old slot must not be released until the new one is
 * actually held, or a client who loses the race ends up with no appointment at
 * all. The claim reuses the conditional `updateMany` — the WHERE still requires
 * `isActive: true`, so a concurrent request matches nothing instead of putting
 * two clients in one slot.
 */
const TENANT = 1n;
const CLIENT = 9n;
const PROVIDER = 5n;
const BOOKING = 100n;
const OLD_SLOT = 3n;
const NEW_SLOT = 4n;

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600000);

function makeService({
  booking,
  target,
  claimCount = 1,
  movedCount = 1,
  cancellationHours = 24,
}: {
  booking?: any;
  target?: any;
  claimCount?: number;
  movedCount?: number;
  cancellationHours?: number;
} = {}) {
  const bookingRow =
    booking === undefined
      ? {
          id: BOOKING,
          tenantId: TENANT,
          clientProfileId: CLIENT,
          serviceId: 2n,
          availabilityId: OLD_SLOT,
          status: 'CONFIRMED',
          availability: { id: OLD_SLOT, providerProfileId: PROVIDER, startsAt: hoursFromNow(72) },
          service: { title: 'Therapy' },
        }
      : booking;

  const targetRow =
    target === undefined
      ? {
          id: NEW_SLOT,
          tenantId: TENANT,
          providerProfileId: PROVIDER,
          serviceId: 2n,
          isActive: true,
          startsAt: hoursFromNow(96),
        }
      : target;

  const tx: any = {
    consultAvailability: {
      updateMany: vi.fn().mockResolvedValue({ count: claimCount }),
      update: vi.fn(),
    },
    consultBooking: {
      updateMany: vi.fn().mockResolvedValue({ count: movedCount }),
      update: vi.fn(),
      findFirst: vi.fn().mockResolvedValue({
        id: BOOKING,
        clientProfileId: CLIENT,
        status: 'CONFIRMED',
        availability: {
          providerProfileId: PROVIDER,
          startsAt: hoursFromNow(96),
          endsAt: hoursFromNow(97),
        },
        service: { title: 'Therapy' },
        client: { firstName: 'Ada', lastName: 'Obi', email: 'ada@example.com' },
      }),
    },
  };

  const prisma: any = {
    consultBooking: { findFirst: vi.fn().mockResolvedValue(bookingRow) },
    consultAvailability: {
      findFirst: vi.fn().mockResolvedValue(targetRow),
      findMany: vi.fn().mockResolvedValue([
        { id: NEW_SLOT, startsAt: hoursFromNow(96), endsAt: hoursFromNow(97), channel: 'VIDEO' },
      ]),
    },
    tenant: { findUnique: vi.fn().mockResolvedValue({ cancellationHours }) },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
  };

  const service = new ConsultService(
    prisma,
    { notify: vi.fn() } as any,
    {} as any,
    {} as any,
    {} as any,
    { pushBookingToGoogle: vi.fn() } as any,
  );
  return { service, prisma, tx };
}

const move = (s: ConsultService) => s.rescheduleBooking(TENANT, CLIENT, BOOKING, NEW_SLOT);

describe('rescheduling a booking', () => {
  describe('who is allowed to', () => {
    it('finds the booking by tenant and by the client in the session', async () => {
      const { service, prisma } = makeService();
      await move(service);
      expect(prisma.consultBooking.findFirst.mock.calls[0][0].where).toMatchObject({
        id: BOOKING,
        tenantId: TENANT,
        clientProfileId: CLIENT,
      });
    });

    // Without the clientProfileId in the WHERE, any signed-in client could move
    // a stranger's appointment by guessing a booking id.
    it('refuses a booking that is not theirs', async () => {
      const { service, tx } = makeService({ booking: null });
      await expect(move(service)).rejects.toThrow(NotFoundException);
      expect(tx.consultAvailability.updateMany).not.toHaveBeenCalled();
    });

    it('refuses a cancelled session', async () => {
      const { service } = makeService({
        booking: {
          id: BOOKING,
          status: 'CANCELLED',
          availabilityId: OLD_SLOT,
          serviceId: 2n,
          availability: { providerProfileId: PROVIDER, startsAt: hoursFromNow(72) },
          service: { title: 'Therapy' },
        },
      });
      await expect(move(service)).rejects.toThrow(BadRequestException);
    });

    it('refuses a completed session', async () => {
      const { service } = makeService({
        booking: {
          id: BOOKING,
          status: 'COMPLETED',
          availabilityId: OLD_SLOT,
          serviceId: 2n,
          availability: { providerProfileId: PROVIDER, startsAt: hoursFromNow(-72) },
          service: { title: 'Therapy' },
        },
      });
      await expect(move(service)).rejects.toThrow(BadRequestException);
    });
  });

  describe('the practice notice period', () => {
    it('refuses inside the window the practice set', async () => {
      const { service, tx } = makeService({
        booking: {
          id: BOOKING,
          status: 'CONFIRMED',
          availabilityId: OLD_SLOT,
          serviceId: 2n,
          availability: { providerProfileId: PROVIDER, startsAt: hoursFromNow(2) },
          service: { title: 'Therapy' },
        },
      });
      await expect(move(service)).rejects.toThrow(BadRequestException);
      expect(tx.consultAvailability.updateMany).not.toHaveBeenCalled();
    });

    it('honours a practice that set a longer notice', async () => {
      const { service } = makeService({
        cancellationHours: 96,
        booking: {
          id: BOOKING,
          status: 'CONFIRMED',
          availabilityId: OLD_SLOT,
          serviceId: 2n,
          // Fine under the 24h default, too late under this practice's 96h.
          availability: { providerProfileId: PROVIDER, startsAt: hoursFromNow(72) },
          service: { title: 'Therapy' },
        },
      });
      await expect(move(service)).rejects.toThrow(BadRequestException);
    });

    it('allows a move well outside the window', async () => {
      const { service } = makeService();
      await expect(move(service)).resolves.toMatchObject({ id: '100' });
    });
  });

  describe('the slot being moved to', () => {
    it('refuses one already taken', async () => {
      const { service } = makeService({
        target: { id: NEW_SLOT, tenantId: TENANT, providerProfileId: PROVIDER, serviceId: 2n, isActive: false, startsAt: hoursFromNow(96) },
      });
      await expect(move(service)).rejects.toThrow(BadRequestException);
    });

    // Slots are looked up by id; without the tenant in the WHERE a client could
    // point their booking at another practice's calendar.
    it('refuses one from another practice', async () => {
      const { service, prisma } = makeService();
      await move(service);
      expect(prisma.consultAvailability.findFirst.mock.calls[0][0].where).toMatchObject({
        id: NEW_SLOT,
        tenantId: TENANT,
      });
    });

    it('refuses one in the past', async () => {
      const { service } = makeService({
        target: { id: NEW_SLOT, tenantId: TENANT, providerProfileId: PROVIDER, serviceId: 2n, isActive: true, startsAt: hoursFromNow(-1) },
      });
      await expect(move(service)).rejects.toThrow(BadRequestException);
    });

    it("refuses another practitioner's slot", async () => {
      const { service, tx } = makeService({
        target: { id: NEW_SLOT, tenantId: TENANT, providerProfileId: 99n, serviceId: 2n, isActive: true, startsAt: hoursFromNow(96) },
      });
      await expect(move(service)).rejects.toThrow(BadRequestException);
      expect(tx.consultAvailability.updateMany).not.toHaveBeenCalled();
    });

    it('refuses a slot open for a different service', async () => {
      const { service } = makeService({
        target: { id: NEW_SLOT, tenantId: TENANT, providerProfileId: PROVIDER, serviceId: 77n, isActive: true, startsAt: hoursFromNow(96) },
      });
      await expect(move(service)).rejects.toThrow(BadRequestException);
    });

    it('refuses the slot it is already in', async () => {
      const { service } = makeService();
      await expect(service.rescheduleBooking(TENANT, CLIENT, BOOKING, OLD_SLOT)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('the swap itself', () => {
    it('claims the new slot with the condition still in the update', async () => {
      const { service, tx } = makeService();
      await move(service);
      expect(tx.consultAvailability.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: NEW_SLOT, tenantId: TENANT, isActive: true },
        data: { isActive: false },
      });
    });

    it('never deactivates a slot unconditionally', async () => {
      const { service, tx } = makeService();
      await move(service);
      expect(tx.consultAvailability.update).not.toHaveBeenCalled();
    });

    it('gives the old slot back so someone else can book it', async () => {
      const { service, tx } = makeService();
      await move(service);
      expect(tx.consultAvailability.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: OLD_SLOT, tenantId: TENANT },
        data: { isActive: true },
      });
    });

    it('points the booking at the new slot, scoped to tenant and client', async () => {
      const { service, tx } = makeService();
      await move(service);
      const call = tx.consultBooking.updateMany.mock.calls[0][0];
      expect(call.where).toMatchObject({ id: BOOKING, tenantId: TENANT, clientProfileId: CLIENT });
      expect(call.data.availabilityId).toBe(NEW_SLOT);
    });

    // Releasing first would leave the client with nothing if the claim then lost.
    it('holds the new slot before releasing the old one', async () => {
      const { service, tx } = makeService();
      const order: bigint[] = [];
      tx.consultAvailability.updateMany.mockImplementation(async ({ where }: any) => {
        order.push(where.id);
        return { count: 1 };
      });
      await move(service);
      expect(order).toEqual([NEW_SLOT, OLD_SLOT]);
    });

    describe('when another client claimed the slot first', () => {
      it('refuses the move', async () => {
        const { service } = makeService({ claimCount: 0 });
        await expect(move(service)).rejects.toThrow(BadRequestException);
      });

      it('leaves the original booking where it was', async () => {
        const { service, tx } = makeService({ claimCount: 0 });
        await move(service).catch(() => undefined);
        expect(tx.consultBooking.updateMany).not.toHaveBeenCalled();
        // The old slot must not be handed back either.
        expect(tx.consultAvailability.updateMany).toHaveBeenCalledTimes(1);
      });
    });

    it('does not silently succeed if the booking write matched nothing', async () => {
      const { service } = makeService({ movedCount: 0 });
      await expect(move(service)).rejects.toThrow(BadRequestException);
    });
  });

  describe('afterwards', () => {
    it('tells the practitioner', async () => {
      const { service } = makeService();
      const notify = vi.fn();
      (service as any).notifications = { notify };
      await move(service);
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT, profileIds: [PROVIDER] }),
      );
    });

    // The booking has already moved by this point; a mail or calendar outage
    // must not report failure to a client whose session did change.
    it('still succeeds when the notification fails', async () => {
      const { service } = makeService();
      (service as any).notifications = { notify: vi.fn().mockRejectedValue(new Error('smtp')) };
      await expect(move(service)).resolves.toBeDefined();
    });

    it('still succeeds when the calendar push fails', async () => {
      const { service } = makeService();
      (service as any).calendar = {
        pushBookingToGoogle: vi.fn().mockRejectedValue(new Error('google')),
      };
      await expect(move(service)).resolves.toBeDefined();
    });

    it('returns the new time', async () => {
      const { service } = makeService();
      const result = await move(service);
      expect(new Date(result.startsAt).getTime()).toBeGreaterThan(Date.now());
    });
  });
});

describe('the slots offered for a reschedule', () => {
  const options = (s: ConsultService) => s.getRescheduleOptions(TENANT, CLIENT, BOOKING);

  it('offers only the same practitioner and the same service', async () => {
    const { service, prisma } = makeService();
    await options(service);
    expect(prisma.consultAvailability.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: TENANT,
      providerProfileId: PROVIDER,
      serviceId: 2n,
      isActive: true,
    });
  });

  it('excludes the slot the session is already in', async () => {
    const { service, prisma } = makeService();
    await options(service);
    expect(prisma.consultAvailability.findMany.mock.calls[0][0].where.id).toEqual({
      not: OLD_SLOT,
    });
  });

  // Offering a slot inside the notice window would show a time the reschedule
  // itself then refuses.
  it('offers nothing sooner than the notice period allows', async () => {
    const { service, prisma } = makeService({ cancellationHours: 48 });
    await options(service);
    const earliest = prisma.consultAvailability.findMany.mock.calls[0][0].where.startsAt.gte;
    expect(earliest.getTime()).toBeGreaterThan(Date.now() + 47 * 3600000);
  });

  it('refuses to list options for a booking that is not theirs', async () => {
    const { service } = makeService({ booking: null });
    await expect(options(service)).rejects.toThrow(NotFoundException);
  });

  it('refuses to list options for a session inside the notice window', async () => {
    const { service } = makeService({
      booking: {
        id: BOOKING,
        status: 'CONFIRMED',
        availabilityId: OLD_SLOT,
        serviceId: 2n,
        availability: { providerProfileId: PROVIDER, startsAt: hoursFromNow(1) },
        service: { title: 'Therapy' },
      },
    });
    await expect(options(service)).rejects.toThrow(BadRequestException);
  });
});
