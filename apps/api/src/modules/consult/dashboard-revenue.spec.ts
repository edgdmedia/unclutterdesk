import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsultService } from './consult.service';

/**
 * Revenue on the practice dashboard.
 *
 * It summed `service.priceKobo` over every booking created this month with a
 * CONFIRMED or COMPLETED status. That overstated the figure three ways: a
 * booking made with a discount code was counted at full list price, a service
 * the practice had repriced revalued bookings made months ago, and a booking
 * confirmed but never paid for was counted as money in the bank. The dashboard
 * then drew twelve months of history by multiplying that one number by a fixed
 * ramp, so every practice saw the same invented growth story.
 */
const TENANT = 1n;
const NOW = new Date(2026, 8, 20); // 20 September 2026

function paid(amountKobo: bigint | null, when: Date, priceKobo = 800000n) {
  return { amountKobo, paidAt: when, service: { priceKobo } };
}

function makeService(bookings: unknown[]) {
  const prisma: any = {
    consultBooking: {
      findMany: vi
        .fn()
        // The dashboard runs two booking queries: revenue, then what is coming up.
        .mockResolvedValueOnce(bookings)
        .mockResolvedValueOnce([]),
    },
    profile: { count: vi.fn().mockResolvedValue(0) },
    consultAvailability: { count: vi.fn().mockResolvedValue(1) },
    consultService: { count: vi.fn().mockResolvedValue(1) },
    bankSubaccount: { count: vi.fn().mockResolvedValue(1) },
  };
  const service = new ConsultService(
    prisma, {} as any, {} as any, {} as any, {} as any, {} as any,
  );
  return { service, prisma };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('which bookings count as revenue', () => {
  it('asks the database only for bookings that were paid', async () => {
    const { service, prisma } = makeService([]);
    await service.getDashboardSummary(TENANT);
    const where = prisma.consultBooking.findMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe(TENANT);
    expect(where.paidAt.gte).toBeInstanceOf(Date);
  });

  it('no longer filters on a booking status, which said nothing about payment', async () => {
    const { service, prisma } = makeService([]);
    await service.getDashboardSummary(TENANT);
    expect(prisma.consultBooking.findMany.mock.calls[0][0].where.status).toBeUndefined();
  });

  it('reaches back a full twelve months, not to the start of this month', async () => {
    const { service, prisma } = makeService([]);
    await service.getDashboardSummary(TENANT);
    const from: Date = prisma.consultBooking.findMany.mock.calls[0][0].where.paidAt.gte;
    expect([from.getFullYear(), from.getMonth(), from.getDate()]).toEqual([2025, 9, 1]);
  });
});

describe('what this month earned', () => {
  it('uses the amount charged, not the service price today', async () => {
    // Booked at ₦4,500 with a discount; the service now lists at ₦8,000.
    const { service } = makeService([paid(450000n, new Date(2026, 8, 2))]);
    await expect(service.getDashboardSummary(TENANT)).resolves.toMatchObject({
      revenueThisMonthNaira: 4500,
    });
  });

  it('adds up everything collected this month', async () => {
    const { service } = makeService([
      paid(450000n, new Date(2026, 8, 2)),
      paid(300000n, new Date(2026, 8, 15)),
    ]);
    await expect(service.getDashboardSummary(TENANT)).resolves.toMatchObject({
      revenueThisMonthNaira: 7500,
      revenueThisMonthKobo: '750000',
    });
  });

  it('leaves last month out of this month', async () => {
    const { service } = makeService([
      paid(450000n, new Date(2026, 8, 2)),
      paid(999900n, new Date(2026, 7, 30)),
    ]);
    await expect(service.getDashboardSummary(TENANT)).resolves.toMatchObject({
      revenueThisMonthNaira: 4500,
    });
  });

  it('falls back to the service price for a booking made before amounts were recorded', async () => {
    const { service } = makeService([paid(null, new Date(2026, 8, 2), 800000n)]);
    await expect(service.getDashboardSummary(TENANT)).resolves.toMatchObject({
      revenueThisMonthNaira: 8000,
    });
  });

  it('reports nothing for a practice that has taken no money', async () => {
    const { service } = makeService([]);
    await expect(service.getDashboardSummary(TENANT)).resolves.toMatchObject({
      revenueThisMonthNaira: 0,
    });
  });
});

describe('the twelve-month series', () => {
  it('is real months rather than a ramp derived from this one', async () => {
    const { service } = makeService([paid(500000n, new Date(2026, 8, 2))]);
    const summary = await service.getDashboardSummary(TENANT);
    expect(summary.monthlyRevenue).toHaveLength(12);
    // Every earlier month is zero, because nothing was collected in them.
    expect(summary.monthlyRevenue.slice(0, 11).map((m) => m.revenueNaira)).toEqual(
      new Array(11).fill(0),
    );
  });

  it('ends on the current month', async () => {
    const { service } = makeService([]);
    const summary = await service.getDashboardSummary(TENANT);
    expect(summary.monthlyRevenue[11].month).toBe('2026-09');
  });

  it('places a payment in the month it arrived', async () => {
    const { service } = makeService([paid(300000n, new Date(2026, 5, 9))]);
    const summary = await service.getDashboardSummary(TENANT);
    const june = summary.monthlyRevenue.find((m) => m.month === '2026-06');
    expect(june?.revenueNaira).toBe(3000);
  });
});

describe('the change against last month', () => {
  it('is the real difference', async () => {
    const { service } = makeService([
      paid(400000n, new Date(2026, 7, 10)),
      paid(500000n, new Date(2026, 8, 10)),
    ]);
    await expect(service.getDashboardSummary(TENANT)).resolves.toMatchObject({
      revenueChangePercent: 25,
    });
  });

  // The page showed a fixed "+100%" beside any non-zero figure.
  it('is absent rather than invented when last month earned nothing', async () => {
    const { service } = makeService([paid(500000n, new Date(2026, 8, 10))]);
    await expect(service.getDashboardSummary(TENANT)).resolves.toMatchObject({
      revenueChangePercent: null,
    });
  });
});
