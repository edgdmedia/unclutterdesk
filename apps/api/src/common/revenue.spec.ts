import { describe, it, expect } from 'vitest';
import {
  chargedKobo,
  collectedKobo,
  changePercent,
  koboToNaira,
  revenueByMonth,
  startOfMonth,
} from './revenue';

/**
 * What a booking earned.
 *
 * Every revenue figure summed `service.priceKobo` over bookings, so a booking
 * made with a discount code was reported at full list price, a repriced service
 * revalued bookings made months ago, and — on the platform admin screens — a
 * cancelled booking nobody ever paid for counted as income.
 */
const PAID = new Date('2026-09-02T10:00:00Z');

describe('chargedKobo', () => {
  it('uses the amount settled at booking time', () => {
    expect(chargedKobo({ amountKobo: 450000n, service: { priceKobo: 500000n } })).toBe(450000n);
  });

  // The whole point: the discount is already baked into amountKobo.
  it('does not revalue a discounted booking at list price', () => {
    const discounted = { amountKobo: 450000n, service: { priceKobo: 500000n } };
    expect(chargedKobo(discounted)).not.toBe(500000n);
  });

  it('does not follow the service when the practice reprices', () => {
    const booked = { amountKobo: 500000n, service: { priceKobo: 900000n } };
    expect(chargedKobo(booked)).toBe(500000n);
  });

  it('keeps a free booking at nothing rather than falling back to the price', () => {
    // 0n is a real amount; only null means "never recorded".
    expect(chargedKobo({ amountKobo: 0n, service: { priceKobo: 500000n } })).toBe(0n);
  });

  it('falls back to the service price for rows written before amountKobo existed', () => {
    expect(chargedKobo({ amountKobo: null, service: { priceKobo: 800000n } })).toBe(800000n);
  });

  it('reports nothing rather than throwing when there is no service either', () => {
    expect(chargedKobo({ amountKobo: null, service: null })).toBe(0n);
  });
});

describe('collectedKobo', () => {
  it('counts what was paid', () => {
    expect(
      collectedKobo([
        { amountKobo: 500000n, paidAt: PAID },
        { amountKobo: 300000n, paidAt: PAID },
      ]),
    ).toBe(800000n);
  });

  // Confirmed is not paid: the old figure counted a booking the moment it was
  // confirmed, so the dashboard reported money that had not arrived.
  it('ignores a booking that is confirmed but unpaid', () => {
    expect(collectedKobo([{ amountKobo: 500000n, paidAt: null }])).toBe(0n);
  });

  it('earns nothing from a fully discounted booking, which is confirmed without a payment', () => {
    expect(collectedKobo([{ amountKobo: 0n, paidAt: null, service: { priceKobo: 500000n } }])).toBe(
      0n,
    );
  });

  it('stays exact past the range a double can hold', () => {
    // Number.MAX_SAFE_INTEGER is 9007199254740991; adding 1 to it in floating
    // point is a no-op, so the sum has to stay in BigInt.
    const total = collectedKobo([
      { amountKobo: 9007199254740991n, paidAt: PAID },
      { amountKobo: 1n, paidAt: PAID },
    ]);
    expect(total).toBe(9007199254740992n);
  });

  it('is zero for a practice with no income, not NaN', () => {
    expect(collectedKobo([])).toBe(0n);
  });
});

describe('koboToNaira', () => {
  it('divides by a hundred', () => {
    expect(koboToNaira(450050n)).toBe(4500.5);
  });
});

describe('startOfMonth', () => {
  it('is the first instant of the month', () => {
    const start = startOfMonth(new Date(2026, 8, 17, 13, 45));
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2026, 8, 1]);
    expect(start.getHours()).toBe(0);
  });

  it('walks back across a year boundary', () => {
    const start = startOfMonth(new Date(2026, 1, 15), 3);
    expect([start.getFullYear(), start.getMonth()]).toEqual([2025, 10]);
  });
});

describe('revenueByMonth', () => {
  const now = new Date(2026, 8, 20); // September 2026

  it('ends with the month being asked about', () => {
    const series = revenueByMonth([], now);
    expect(series[series.length - 1].month).toBe('2026-09');
  });

  it('runs oldest first over twelve months', () => {
    const series = revenueByMonth([], now);
    expect(series).toHaveLength(12);
    expect(series[0].month).toBe('2025-10');
  });

  it('puts each payment in the month it was received', () => {
    const series = revenueByMonth(
      [
        { amountKobo: 500000n, paidAt: new Date(2026, 8, 2) },
        { amountKobo: 300000n, paidAt: new Date(2026, 7, 28) },
      ],
      now,
    );
    const by = Object.fromEntries(series.map((m) => [m.month, m.revenueNaira]));
    expect(by['2026-09']).toBe(5000);
    expect(by['2026-08']).toBe(3000);
  });

  it('adds up several payments in one month', () => {
    const series = revenueByMonth(
      [
        { amountKobo: 500000n, paidAt: new Date(2026, 8, 2) },
        { amountKobo: 250000n, paidAt: new Date(2026, 8, 19) },
      ],
      now,
    );
    expect(series[series.length - 1].revenueKobo).toBe('750000');
  });

  // The page drew twelve bars by multiplying this month by 0.5, 0.6, 0.55 …
  // so every practice on the platform saw the same invented growth story.
  it('reports a month with no income as zero rather than a fraction of another month', () => {
    const series = revenueByMonth([{ amountKobo: 500000n, paidAt: new Date(2026, 8, 2) }], now);
    expect(series.slice(0, 11).every((m) => m.revenueNaira === 0)).toBe(true);
  });

  it('does not tell the same story to a practice that has earned nothing', () => {
    expect(revenueByMonth([], now).every((m) => m.revenueNaira === 0)).toBe(true);
  });

  it('ignores unpaid bookings, wherever they were made', () => {
    const series = revenueByMonth([{ amountKobo: 500000n, paidAt: null }], now);
    expect(series.every((m) => m.revenueNaira === 0)).toBe(true);
  });

  it('distinguishes the same month in different years', () => {
    const series = revenueByMonth(
      [{ amountKobo: 500000n, paidAt: new Date(2025, 8, 2) }],
      now,
    );
    // September 2025 is before the window, so it must not land in September 2026.
    expect(series[series.length - 1].revenueNaira).toBe(0);
  });

  it('carries kobo as a string, so a large total survives JSON', () => {
    const series = revenueByMonth(
      [{ amountKobo: 9007199254740993n, paidAt: new Date(2026, 8, 2) }],
      now,
    );
    expect(series[series.length - 1].revenueKobo).toBe('9007199254740993');
  });
});

describe('changePercent', () => {
  function series(previous: bigint, current: bigint) {
    return revenueByMonth(
      [
        { amountKobo: previous, paidAt: new Date(2026, 7, 10) },
        { amountKobo: current, paidAt: new Date(2026, 8, 10) },
      ],
      new Date(2026, 8, 20),
    );
  }

  it('reports real growth', () => {
    expect(changePercent(series(400000n, 500000n))).toBe(25);
  });

  it('reports a fall as a negative', () => {
    expect(changePercent(series(500000n, 400000n))).toBe(-20);
  });

  // The badge was a hard-coded "+100%" beside any non-zero figure, which told a
  // practice it had doubled its income on the strength of having earned
  // anything at all.
  it('offers no percentage when last month earned nothing', () => {
    expect(changePercent(series(0n, 500000n))).toBeNull();
  });

  it('offers no percentage when there is no earlier month to compare', () => {
    expect(changePercent([])).toBeNull();
  });
});
