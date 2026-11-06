import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PlanSessionService } from './plan-session.service';

/**
 * Sessions paid at the practice with no time yet (spec §11.2): a client pays
 * the desk for four sessions and will choose the times when she knows them.
 * The plan session is the only record of that money, so it is revenue
 * (paidAt) and appears in her payments; the times are chosen later as with
 * any not-yet-scheduled session.
 */
const TENANT = 1n;
const PROVIDER = 6n;
const CLIENT = 40n;

function make(over: { role?: string; formats?: any[]; plan?: any; line?: any; therapist?: any } = {}) {
  const tx: any = {
    sessionPlan: {
      findFirst: vi.fn().mockResolvedValue(over.plan ?? null),
      create: vi.fn(async ({ data }: any) => ({ id: 5n, ...data })),
    },
    sessionPlanLine: {
      findFirst: vi.fn().mockResolvedValue(over.line ?? null),
      create: vi.fn(async ({ data }: any) => ({ id: 7n, ...data })),
      update: vi.fn(async ({ data }: any) => ({ id: 7n, ...data })),
    },
    planSession: { create: vi.fn(async ({ data }: any) => ({ id: 50n + BigInt(tx.planSession.create.mock.calls.length), ...data })) },
  };
  const prisma: any = {
    profile: {
      findFirst: vi.fn(async ({ where }: any) =>
        where.id === CLIENT
          ? { id: CLIENT, firstName: 'Ada', lastName: 'Ola', email: 'ada@example.com', timezone: null }
          : { id: where.id, role: over.role ?? 'OWNER', firstName: 'Desk', lastName: 'One' },
      ),
    },
    consultTherapistProfile: {
      findFirst: vi.fn().mockResolvedValue(
        over.therapist ?? { profileId: PROVIDER, offersOnline: true, offersInPerson: true, workLocations: [{ locationId: 4n }], profile: { firstName: 'Segun', lastName: 'Ade' } },
      ),
    },
    consultService: {
      findFirst: vi.fn().mockResolvedValue({
        id: 2n, title: 'Individual Therapy', durationMinutes: 50, priceKobo: 3_500_000n,
        formats: over.formats ?? [{ format: 'ONLINE', priceKobo: 3_500_000n, isActive: true }, { format: 'IN_PERSON', priceKobo: 4_000_000n, isActive: true }],
      }),
    },
    tenant: { findUnique: vi.fn().mockResolvedValue({ id: TENANT, name: 'Calm Practice', slug: 'calm' }) },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
  };
  const notifications: any = { sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  const service = new PlanSessionService(prisma, {} as any, notifications, {} as any);
  return { service, prisma, tx, notifications };
}

const dto = (over: Record<string, unknown> = {}) => ({
  clientProfileId: '40', serviceId: '2', providerProfileId: '6', count: 4, format: 'ONLINE', payment: 'PAID', ...over,
});

describe('adding sessions paid at the practice, times chosen later', () => {
  it('makes one paid session per count, the money on each, paid now', async () => {
    const { service, tx } = make();
    const r = await service.addPaid(TENANT, 9n, dto() as any);
    expect(tx.planSession.create).toHaveBeenCalledTimes(4);
    const first = tx.planSession.create.mock.calls[0][0].data;
    expect(first).toMatchObject({
      tenantId: TENANT, clientProfileId: CLIENT, providerProfileId: PROVIDER, serviceId: 2n, format: 'ONLINE',
      status: 'PAID', paymentMethod: 'MANUAL', amountKobo: 3_500_000n, paidOnBookingId: null, bookingId: null, createdByProfileId: 9n,
    });
    // paidAt makes it revenue, counted once (DIRECT_PLAN_PAYMENT).
    expect(first.paidAt).toBeInstanceOf(Date);
    expect(r.count).toBe(4);
  });

  it('takes the amount received per session', async () => {
    const { service, tx } = make();
    await service.addPaid(TENANT, 9n, dto({ amountKobo: '3000000' }) as any);
    expect(tx.planSession.create.mock.calls[0][0].data.amountKobo).toBe(3_000_000n);
  });

  it('prices in person at the in-person price, at a place the practitioner works', async () => {
    const { service, tx } = make();
    await service.addPaid(TENANT, 9n, dto({ format: 'IN_PERSON', locationId: '4' }) as any);
    expect(tx.planSession.create.mock.calls[0][0].data).toMatchObject({ format: 'IN_PERSON', locationId: 4n, amountKobo: 4_000_000n });
    const { service: s2 } = make();
    await expect(s2.addPaid(TENANT, 9n, dto({ format: 'IN_PERSON', locationId: '99' }) as any)).rejects.toThrow(/where/i);
  });

  it('records no charge without making it revenue', async () => {
    const { service, tx } = make();
    await service.addPaid(TENANT, 9n, dto({ payment: 'NONE' }) as any);
    const row = tx.planSession.create.mock.calls[0][0].data;
    expect(row).toMatchObject({ paymentMethod: 'NONE', amountKobo: 0n, paidAt: null });
  });

  it('adds to the client’s plan with this practitioner', async () => {
    const { service, tx } = make({ plan: { id: 5n }, line: { id: 7n, count: 2 } });
    await service.addPaid(TENANT, 9n, dto() as any);
    expect(tx.sessionPlan.create).not.toHaveBeenCalled();
    expect(tx.sessionPlanLine.update).toHaveBeenCalledWith({ where: { id: 7n }, data: { count: 6 } });
  });

  it('only the desk or an admin marks money received, as with bookings', async () => {
    const { service } = make({ role: 'THERAPIST' });
    await expect(service.addPaid(TENANT, PROVIDER, dto() as any)).rejects.toBeInstanceOf(ForbiddenException);
    const { service: own } = make({ role: 'THERAPIST' });
    await expect(own.addPaid(TENANT, PROVIDER, dto({ payment: 'NONE' }) as any)).resolves.toMatchObject({ count: 4 });
  });

  it('online payment is not offered for sessions without a time yet', async () => {
    const { service } = make();
    await expect(service.addPaid(TENANT, 9n, dto({ payment: 'LINK' }) as any)).rejects.toThrow(/at the practice/i);
  });

  it('between 1 and 12 at once', async () => {
    for (const count of [0, 13, 2.5, 'x']) {
      const { service } = make();
      await expect(service.addPaid(TENANT, 9n, dto({ count }) as any)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('a format the service does not offer is refused', async () => {
    const { service } = make({ formats: [{ format: 'ONLINE', priceKobo: 3_500_000n, isActive: true }] });
    await expect(service.addPaid(TENANT, 9n, dto({ format: 'IN_PERSON', locationId: '4' }) as any)).rejects.toThrow(/not offered in person/i);
  });

  it('emails the client to choose the times, unless asked not to', async () => {
    const one = make();
    await one.service.addPaid(TENANT, 9n, dto() as any);
    expect(one.notifications.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ada@example.com', type: 'bookings.sessions_to_schedule', actionLabel: 'Choose times' }));
    const quiet = make();
    await quiet.service.addPaid(TENANT, 9n, dto({ notifyClient: false }) as any);
    expect(quiet.notifications.sendEmail).not.toHaveBeenCalled();
  });
});
