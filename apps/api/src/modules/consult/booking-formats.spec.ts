import { describe, expect, it, vi } from 'vitest';
import { ConsultService } from './consult.service';
import { BookingNotifier } from '../notifications/booking-notifier.service';

/**
 * SET-06/BKG-05: a booking takes a format, the price follows the format, and
 * an in-person booking gets the address instead of a join link.
 */
const TENANT = 1n;
const CLIENT = 5n;

const onlineSlot = {
  id: 3n, tenantId: TENANT, providerProfileId: 7n, serviceId: null, startsAt: new Date('2026-10-09T09:00:00Z'), endsAt: new Date('2026-10-09T09:50:00Z'),
  channel: 'VIDEO', allowsOnline: true, allowsInPerson: false, locationId: null, customised: false, isActive: true, location: null,
  therapist: { credentials: null, specialty: null, offersOnline: true, offersInPerson: false, workLocations: [], profile: { firstName: 'Jane', lastName: 'Smith', avatarUrl: null } },
  service: null, tenant: { subscriptionTier: 'PRO', slug: 'p' },
};
const bothSlot = { ...onlineSlot, id: 4n, allowsInPerson: true, locationId: 4n, channel: 'IN_PERSON', location: { id: 4n, name: 'Lekki clinic', city: 'Lagos', address: '12 Admiralty Way', directions: 'Gate 2' }, therapist: { ...onlineSlot.therapist, offersInPerson: true, workLocations: [{ locationId: 4n }] } };

const svcRow = (formats: unknown[] = []) => ({
  id: 20n, tenantId: TENANT, title: 'Talk', description: null, durationMinutes: 50, priceKobo: 3000000n, isActive: true, formats,
});

function makeService({ slots = [onlineSlot, bothSlot], svc = svcRow([{ format: 'ONLINE', priceKobo: 3000000n, isActive: true }, { format: 'IN_PERSON', priceKobo: 3500000n, isActive: true }]) } = {}) {
  const tx: any = {
    consultAvailability: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    consultBooking: { create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: 900n, holdExpiresAt: null, ...data })), update: vi.fn() },
    discountCode: { update: vi.fn() },
  };
  const prisma: any = {
    consultAvailability: {
      findMany: vi.fn().mockResolvedValue(slots),
      findFirst: vi.fn(async ({ where }: any) => slots.find((x) => x.id === where.id && x.isActive) ?? null),
    },
    consultService: { findFirst: vi.fn().mockResolvedValue(svc) },
    consultBooking: { count: vi.fn().mockResolvedValue(0) },
    profile: { findFirst: vi.fn().mockResolvedValue({ id: CLIENT, email: 'ada@example.com', firstName: 'Ada', lastName: 'O', phone: '080' }) },
    tenant: { findUnique: vi.fn().mockResolvedValue({ id: TENANT, slug: 'p', customDomain: null, customDomainStatus: null }) },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
  };
  const notifications = { sendEmail: vi.fn().mockResolvedValue({ success: true }), notify: vi.fn().mockResolvedValue([]) };
  const billing = { calculateSplitPayout: vi.fn(async (_t: unknown, amountKobo: bigint) => ({ platformFeeKobo: '0', therapistPayoutKobo: amountKobo.toString(), tier: 'PRO' })) };
  const paystack = { initializeTransaction: vi.fn().mockResolvedValue({ authorization_url: 'https://checkout.paystack.com/x', access_code: 'ac_1' }) };
  const service_ = new ConsultService(prisma, notifications as any, { validateDiscount: vi.fn().mockResolvedValue({ finalKobo: '3150000' }) } as any, billing as any, paystack as any, { pushBookingToGoogle: vi.fn() } as any, { announce: vi.fn() } as any);
  return { service: service_, prisma, tx, notifications, paystack };
}

describe('public availability with formats', () => {
  it('returns each slot with its formats and, for in person, the location', async () => {
    const { service } = makeService();
    const list = await service.getPublicAvailability(TENANT);
    expect(list.map((s) => [s.id, s.formats])).toEqual([['3', ['ONLINE']], ['4', ['ONLINE', 'IN_PERSON']]]);
    expect(list[1].location).toEqual({ name: 'Lekki clinic', city: 'Lagos' });
  });

  it('filters by format', async () => {
    const { service } = makeService();
    const list = await service.getPublicAvailability(TENANT, undefined, undefined, 'IN_PERSON');
    expect(list.map((s) => s.id)).toEqual(['4']);
  });

  it('hides slots the chosen service does not offer in that format', async () => {
    const { service } = makeService({ svc: svcRow([{ format: 'ONLINE', priceKobo: 3000000n, isActive: true }]) });
    const list = await service.getPublicAvailability(TENANT, undefined, 20n, 'IN_PERSON');
    expect(list).toEqual([]);
  });
});

describe('booking a format', () => {
  const dto = (over: Record<string, unknown> = {}) => ({ serviceId: '20', availabilityId: '4', ...over });

  it('asks for a choice when the time allows both', async () => {
    const { service } = makeService();
    await expect(service.createBooking(TENANT, CLIENT, dto() as any)).rejects.toThrow('Choose online or in person.');
  });

  it('takes the single format when the time allows only one', async () => {
    const { service, tx } = makeService();
    const res: any = await service.createBooking(TENANT, CLIENT, { serviceId: '20', availabilityId: '3' } as any);
    expect(tx.consultBooking.create.mock.calls[0][0].data.format).toBe('ONLINE');
    expect(res.format).toBe('ONLINE');
  });

  it('books in person at the in-person price, stores the location and makes no video room', async () => {
    const { service, tx, paystack } = makeService();
    const res: any = await service.createBooking(TENANT, CLIENT, dto({ format: 'IN_PERSON', discountCode: 'SAVE10' }) as any);
    const created = tx.consultBooking.create.mock.calls[0][0].data;
    expect(created.format).toBe('IN_PERSON');
    expect(created.locationId).toBe(4n);
    expect(created.videoRoomName).toBeFalsy();
    // ₦35,000 in person, 10% discount -> ₦31,500 (the fake validator returns that).
    expect(paystack.initializeTransaction.mock.calls[0][0].amount).toBe(3150000);
    expect(res.location).toMatchObject({ name: 'Lekki clinic', mapsUrl: expect.stringContaining('google.com/maps') });
  });

  it('refuses a format the service stopped offering', async () => {
    const { service } = makeService({ svc: svcRow([{ format: 'ONLINE', priceKobo: 3000000n, isActive: true }]) });
    await expect(service.createBooking(TENANT, CLIENT, dto({ format: 'IN_PERSON' }) as any)).rejects.toThrow(/not offered|another/i);
  });

  it('refuses a format the time does not allow', async () => {
    const { service } = makeService();
    await expect(service.createBooking(TENANT, CLIENT, { serviceId: '20', availabilityId: '3', format: 'IN_PERSON' } as any)).rejects.toThrow(/format|another/i);
  });
});

describe('the confirmed email for an in-person session', () => {
  it('gives the address, directions and a maps link, and no join link', async () => {
    const booking = {
      id: 900n, tenantId: TENANT, status: 'CONFIRMED', paymentMethod: 'PAYSTACK', amountKobo: 3500000n,
      format: 'IN_PERSON', videoRoomName: null,
      service: { title: 'Talk', priceKobo: 3500000n },
      availability: { startsAt: new Date('2026-10-09T09:00:00Z'), channel: 'IN_PERSON', providerProfileId: 7n },
      client: { firstName: 'Ada', lastName: 'O', email: 'ada@example.com' },
      tenant: { name: 'Smith Therapy', slug: 'smith', customDomain: null, customDomainStatus: null },
      location: { name: 'Lekki clinic', address: '12 Admiralty Way', city: 'Lagos', directions: 'Gate 2, second floor' },
    };
    const prisma: any = {
      consultBooking: { findUnique: vi.fn().mockResolvedValue(booking) },
      profile: { findUnique: vi.fn().mockResolvedValue({ firstName: 'Jane', lastName: 'Smith' }), findMany: vi.fn().mockResolvedValue([]) },
      universalForm: { findMany: vi.fn().mockResolvedValue([]) },
      universalFormSubmission: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const notifications = { sendEmail: vi.fn().mockResolvedValue({ success: true }), notify: vi.fn().mockResolvedValue([]) };
    await new BookingNotifier(prisma, notifications as any).confirmed(900n);
    const email = notifications.sendEmail.mock.calls[0][0];
    const where = email.details.find((d: any) => d.label === 'Where').value;
    expect(where).toContain('12 Admiralty Way');
    expect(where).toContain('Gate 2, second floor');
    expect(`${email.link} ${email.message} ${email.details.map((d: any) => d.value).join(' ')}`).not.toMatch(/meet\.jit\.si/);
    expect(email.actionLabel).toBe('Open in Google Maps');
    expect(email.link).toContain('google.com/maps');
  });
});
