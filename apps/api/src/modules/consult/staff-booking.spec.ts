import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StaffBookingService } from './staff-booking.service';

/**
 * Staff booking a session for a client who is already on the books.
 *
 * The same guards as a client booking online (one booking per slot, the
 * practice's own services and practitioners, the Starter limit) plus the ones
 * that only matter when staff do it: who may book for whom, and who may
 * record money as received.
 */
const TENANT = 1n;
const OWNER = 5n;
const THERAPIST = 6n;
const OTHER_THERAPIST = 7n;
const CLIENT = 40n;
const DAY = 24 * 60 * 60 * 1000;
const inDays = (d: number) => new Date(Date.now() + d * DAY);

function setup(over: Record<string, any> = {}) {
  const startsAt = over.startsAt ?? inDays(5);
  const slot = {
    id: 300n,
    tenantId: TENANT,
    providerProfileId: over.slotProvider ?? OWNER,
    serviceId: null,
    service: null,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
    isActive: true,
  };
  const actors: Record<string, any> = {
    [String(OWNER)]: { id: OWNER, role: 'OWNER', firstName: 'Jane', lastName: 'Smith' },
    [String(THERAPIST)]: { id: THERAPIST, role: 'THERAPIST', firstName: 'Ade', lastName: 'B' },
  };
  const client = over.client === undefined ? { id: CLIENT, firstName: 'Ada', lastName: 'Ola', email: 'ada@example.com' } : over.client;
  const tx: any = {
    consultAvailability: {
      updateMany: vi.fn().mockResolvedValue({ count: over.claimCount ?? 1 }),
      create: vi.fn(async ({ data }: any) => ({ id: 301n, ...data })),
    },
    consultBooking: {
      create: vi.fn(async ({ data }: any) => ({ id: 900n, ...data })),
      findFirst: vi.fn().mockResolvedValue(over.clash ?? null),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
  const prisma: any = {
    profile: {
      findFirst: vi.fn(async ({ where }: any) => (where.role === 'CLIENT' ? client : actors[String(where.id)] ?? null)),
    },
    consultTherapistProfile: {
      findFirst: vi.fn(async ({ where }: any) =>
        [OWNER, THERAPIST, OTHER_THERAPIST].includes(where.profileId)
          ? { profileId: where.profileId, videoProvider: 'JITSI', profile: { firstName: 'Jane', lastName: 'Smith' } }
          : null,
      ),
    },
    consultService: {
      findFirst: vi.fn().mockResolvedValue(
        over.service === undefined ? { id: 20n, title: 'Therapy session', durationMinutes: 50, priceKobo: 2500000n } : over.service,
      ),
    },
    consultAvailability: { findFirst: vi.fn().mockResolvedValue(over.slot === undefined ? slot : over.slot) },
    consultBooking: {
      count: vi.fn().mockResolvedValue(over.monthCount ?? 0),
      findFirst: vi.fn().mockResolvedValue({
        id: 900n,
        tenantId: TENANT,
        clientProfileId: CLIENT,
        client: { email: 'ada@example.com' },
        tenant: { name: 'Smith Therapy', slug: 'dr-smith', customDomain: null, customDomainStatus: null },
      }),
    },
    tenant: { findUnique: vi.fn().mockResolvedValue({ id: TENANT, subscriptionTier: over.tier ?? 'PRO', name: 'Smith Therapy', slug: 'dr-smith' }) },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
  };
  const consult: any = {
    resolveVideoRoomLink: vi.fn().mockResolvedValue({ roomName: 'room-1', roomLink: 'https://meet.example/room-1' }),
    startOnlinePayment: vi.fn(),
  };
  const notifications: any = { sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  const calendar: any = { pushBookingToGoogle: vi.fn().mockResolvedValue(undefined) };
  const service = new StaffBookingService(prisma, consult, notifications, calendar);
  return { service, prisma, tx, consult, notifications, calendar, slot };
}

const base = { clientProfileId: String(CLIENT), serviceId: '20', availabilityId: '300' };

describe('payment choices', () => {
  it('a payment link waits for payment and holds the slot', async () => {
    const { service, tx } = setup();
    const res = await service.createForClient(TENANT, OWNER, { ...base, payment: 'LINK' });
    const data = tx.consultBooking.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'PENDING_PAYMENT', paymentMethod: 'PAYSTACK', amountKobo: 2500000n, createdByProfileId: OWNER });
    expect(data.holdExpiresAt).toBeInstanceOf(Date);
    expect(res).toMatchObject({ status: 'PENDING_PAYMENT', paymentMethod: 'PAYSTACK', amountKobo: '2500000' });
  });

  it('marked as paid confirms and records who and when', async () => {
    const { service, tx } = setup();
    await service.createForClient(TENANT, OWNER, { ...base, payment: 'PAID', amountKobo: '2000000' });
    const data = tx.consultBooking.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'CONFIRMED', paymentMethod: 'MANUAL', amountKobo: 2000000n, paymentConfirmedByProfileId: OWNER });
    expect(data.paidAt).toBeInstanceOf(Date);
  });

  it('no charge confirms at zero', async () => {
    const { service, tx } = setup();
    await service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE' });
    expect(tx.consultBooking.create.mock.calls[0][0].data).toMatchObject({ status: 'CONFIRMED', paymentMethod: 'NONE', amountKobo: 0n });
  });

  it('a free service confirms whatever was chosen', async () => {
    const { service, tx } = setup({ service: { id: 20n, title: 'Intro call', durationMinutes: 15, priceKobo: 0n } });
    await service.createForClient(TENANT, OWNER, { ...base, payment: 'LINK' });
    expect(tx.consultBooking.create.mock.calls[0][0].data).toMatchObject({ status: 'CONFIRMED', amountKobo: 0n });
  });

  it('a payment link is refused for a session under 2 hours away', async () => {
    const { service } = setup({ startsAt: new Date(Date.now() + 60 * 60 * 1000) });
    await expect(service.createForClient(TENANT, OWNER, { ...base, payment: 'LINK' })).rejects.toThrow(/starts too soon/);
  });
});

describe('therapist limits', () => {
  it('a therapist books for themselves', async () => {
    const { service, prisma, tx } = setup({ slotProvider: THERAPIST });
    await service.createForClient(TENANT, THERAPIST, { ...base, payment: 'NONE' });
    expect(prisma.consultAvailability.findFirst.mock.calls[0][0].where).toMatchObject({ providerProfileId: THERAPIST });
    expect(tx.consultBooking.create).toHaveBeenCalled();
  });

  it('a therapist may not book for a colleague', async () => {
    const { service } = setup();
    await expect(
      service.createForClient(TENANT, THERAPIST, { ...base, providerProfileId: String(OTHER_THERAPIST), payment: 'NONE' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a therapist may not mark a session paid', async () => {
    const { service } = setup({ slotProvider: THERAPIST });
    await expect(service.createForClient(TENANT, THERAPIST, { ...base, payment: 'PAID' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('what is checked', () => {
  it('the client must be a client of this practice', async () => {
    const { service } = setup({ client: null });
    await expect(service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('the client lookup is scoped to this practice and to clients only', async () => {
    const { service, prisma } = setup();
    await service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE' });
    expect(prisma.profile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CLIENT, tenantId: TENANT, role: 'CLIENT', status: 'active' } }),
    );
  });

  it('the service must be active in this practice', async () => {
    const { service } = setup({ service: null });
    await expect(service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE' })).rejects.toThrow(/service/);
  });

  it('the slot must be long enough for the service', async () => {
    const { service } = setup({ service: { id: 20n, title: 'Long', durationMinutes: 90, priceKobo: 0n } });
    await expect(service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE' })).rejects.toThrow(/too short/);
  });

  it('a slot taken meanwhile is refused and nothing is written', async () => {
    const { service, tx } = setup({ claimCount: 0 });
    await expect(service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE' })).rejects.toThrow(/no longer open/);
    expect(tx.consultBooking.create).not.toHaveBeenCalled();
  });

  it('the Starter monthly limit applies', async () => {
    const { service } = setup({ tier: 'STARTER', monthCount: 20 });
    await expect(service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE' })).rejects.toThrow(/Monthly booking limit/);
  });

  it('a time is required', async () => {
    const { service } = setup();
    await expect(
      service.createForClient(TENANT, OWNER, { clientProfileId: String(CLIENT), serviceId: '20', payment: 'NONE' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('counts a no-charge booking as zero revenue', async () => {
    const { chargedKobo } = await import('../../common/revenue');
    expect(chargedKobo({ amountKobo: 0n, service: { priceKobo: 2500000n } })).toBe(0n);
  });
});

describe('a custom time', () => {
  const custom = (startsAt: Date) => ({ clientProfileId: String(CLIENT), serviceId: '20', startsAt: startsAt.toISOString(), payment: 'NONE' });

  it('makes its own closed slot the length of the service', async () => {
    const { service, tx } = setup();
    const at = inDays(3);
    const res = await service.createForClient(TENANT, OWNER, custom(at));
    expect(tx.consultAvailability.create.mock.calls[0][0].data).toMatchObject({
      tenantId: TENANT,
      providerProfileId: OWNER,
      serviceId: 20n,
      startsAt: at,
      endsAt: new Date(at.getTime() + 50 * 60_000),
      isActive: false,
      createdForBooking: true,
    });
    expect(tx.consultBooking.create.mock.calls[0][0].data.availabilityId).toBe(301n);
    expect(res.endsAt).toBe(new Date(at.getTime() + 50 * 60_000).toISOString());
  });

  it('holds a per-practitioner lock so two custom bookings cannot interleave', async () => {
    const { service, tx } = setup();
    await service.createForClient(TENANT, OWNER, custom(inDays(3)));
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw.mock.calls[0].slice(1)).toEqual([`staff-booking:${TENANT}:${OWNER}`]);
  });

  it('deactivates overlapping open slots before it checks for clashes', async () => {
    // Order matters. The slot update waits on a public booking that is
    // claiming the same slot; the clash check after it then sees that
    // booking, which it would miss if it ran first.
    const { service, tx } = setup();
    const at = inDays(3);
    await service.createForClient(TENANT, OWNER, custom(at));
    const deactivate = tx.consultAvailability.updateMany.mock.invocationCallOrder[0];
    const clashCheck = tx.consultBooking.findFirst.mock.invocationCallOrder[0];
    expect(deactivate).toBeLessThan(clashCheck);
    expect(tx.consultAvailability.updateMany.mock.calls[0][0]).toEqual({
      where: { tenantId: TENANT, providerProfileId: OWNER, isActive: true, startsAt: { lt: new Date(at.getTime() + 50 * 60_000) }, endsAt: { gt: at } },
      data: { isActive: false },
    });
  });

  it('refuses a time that clashes with another session', async () => {
    const clashStart = inDays(3);
    const { service, tx } = setup({
      clash: { availability: { startsAt: clashStart, endsAt: new Date(clashStart.getTime() + 50 * 60_000) } },
    });
    await expect(service.createForClient(TENANT, OWNER, custom(clashStart))).rejects.toThrow(/already has a session/);
    expect(tx.consultBooking.create).not.toHaveBeenCalled();
  });

  it('refuses a time in the past, or not a time at all', async () => {
    const { service } = setup();
    await expect(service.createForClient(TENANT, OWNER, custom(new Date(Date.now() - 60_000)))).rejects.toThrow(/future/);
    await expect(
      service.createForClient(TENANT, OWNER, { clientProfileId: String(CLIENT), serviceId: '20', startsAt: 'tomorrow', payment: 'NONE' }),
    ).rejects.toThrow(/valid time/);
  });
});

describe('after the booking', () => {
  it('emails the client a payment link for a link booking', async () => {
    const { service, notifications, calendar } = setup();
    await service.createForClient(TENANT, OWNER, { ...base, payment: 'LINK' });
    const email = notifications.sendEmail.mock.calls[0][0];
    expect(email).toMatchObject({ to: 'ada@example.com', type: 'bookings.staff_payment_link', tenantId: TENANT, profileId: CLIENT });
    expect(email.link).toMatch(/\/pay\/900\?t=[0-9a-f]{32}$/);
    expect(calendar.pushBookingToGoogle).not.toHaveBeenCalled();
  });

  it('emails a confirmation and syncs the calendar for a confirmed booking', async () => {
    const { service, notifications, calendar } = setup();
    await service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE' });
    expect(notifications.sendEmail.mock.calls[0][0]).toMatchObject({ type: 'bookings.staff_confirmed', link: expect.stringMatching(/\/portal$/) });
    expect(calendar.pushBookingToGoogle).toHaveBeenCalledWith(900n);
  });

  it('sends nothing to the client when staff untick "email the client"', async () => {
    const { service, notifications, calendar } = setup();
    await service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE', notifyClient: false });
    expect(notifications.sendEmail).not.toHaveBeenCalled();
    expect(calendar.pushBookingToGoogle).toHaveBeenCalledWith(900n);
  });

  it('keeps the booking when the email fails', async () => {
    const { service, notifications } = setup();
    notifications.sendEmail.mockRejectedValue(new Error('provider down'));
    await expect(service.createForClient(TENANT, OWNER, { ...base, payment: 'LINK' })).resolves.toMatchObject({ bookingId: '900' });
  });
});
