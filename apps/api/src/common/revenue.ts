/**
 * What a booking earned.
 *
 * Every revenue figure in the product used to be `service.priceKobo` summed
 * over bookings, which is wrong twice over. A service's price moves when the
 * practice reprices, so old bookings were revalued at today's rate; and a
 * booking made with a discount code was counted at full list price, so the
 * dashboard reported money the practice never received. The platform admin
 * screens were worse again: they summed every booking row, so a cancelled
 * booking nobody ever paid for counted as revenue.
 *
 * `ConsultBooking.amountKobo` is the amount settled at booking time, after any
 * discount. It is the only field that answers the question.
 */

/** The parts of a booking that bear on revenue. */
export interface BillableBooking {
  amountKobo?: bigint | null;
  paidAt?: Date | null;
  service?: { priceKobo: bigint } | null;
}

/**
 * What this booking was charged.
 *
 * Rows written before amountKobo existed fall back to the service price, which
 * is exactly right for every booking made without a discount and the best
 * available answer for the rest.
 */
export function chargedKobo(booking: BillableBooking): bigint {
  if (booking.amountKobo !== null && booking.amountKobo !== undefined) {
    return booking.amountKobo;
  }
  return booking.service?.priceKobo ?? 0n;
}

/**
 * What was actually collected.
 *
 * Revenue is money received, so this counts only bookings with a payment date.
 * A booking that is confirmed but unpaid is money owed, not money earned, and
 * a free or fully discounted booking earns nothing however it is confirmed.
 *
 * Refunds are not modelled anywhere, so a booking that was paid and later
 * cancelled still counts — the money did arrive. This matches the client's own
 * payments tab, which totals on the same rule; the two views disagreeing about
 * one booking would be worse than either being incomplete.
 */
export function collectedKobo(bookings: BillableBooking[]): bigint {
  return bookings.reduce((total, b) => (b.paidAt ? total + chargedKobo(b) : total), 0n);
}

/** Kobo are the unit of record; naira is only ever for display. */
export function koboToNaira(kobo: bigint): number {
  return Number(kobo) / 100;
}

/**
 * The first instant of the month `monthsAgo` months before `from`.
 *
 * Server-local, matching every other month boundary in the codebase. A practice
 * in a different zone from the server sees its month roll over at the server's
 * midnight; fixing that means storing a practice timezone and applying it
 * everywhere at once, not here.
 */
export function startOfMonth(from: Date, monthsAgo = 0): Date {
  return new Date(from.getFullYear(), from.getMonth() - monthsAgo, 1);
}

export interface MonthlyRevenue {
  /** "2026-09" — sortable, and unambiguous about which year a month belongs to. */
  month: string;
  /** Single-letter label for a chart axis. */
  label: string;
  revenueKobo: string;
  revenueNaira: number;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Collected revenue for each of the last `months` months, oldest first and
 * ending with the month `now` falls in.
 *
 * The dashboard used to draw a twelve-month bar chart by multiplying this
 * month's figure by a fixed ramp — 0.5, 0.6, 0.55 and so on — so every practice
 * on the platform saw the same invented growth story in its own currency. A
 * month with no income is reported as zero, which is a fact.
 */
export function revenueByMonth(
  bookings: BillableBooking[],
  now: Date = new Date(),
  months = 12,
): MonthlyRevenue[] {
  const buckets = new Map<string, bigint>();

  for (const booking of bookings) {
    if (!booking.paidAt) continue;
    const key = monthKey(booking.paidAt);
    buckets.set(key, (buckets.get(key) ?? 0n) + chargedKobo(booking));
  }

  const series: MonthlyRevenue[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = startOfMonth(now, i);
    const kobo = buckets.get(monthKey(start)) ?? 0n;
    series.push({
      month: monthKey(start),
      label: start.toLocaleString('en-US', { month: 'narrow' }),
      revenueKobo: kobo.toString(),
      revenueNaira: koboToNaira(kobo),
    });
  }
  return series;
}

/**
 * Month-over-month change, as a whole percent.
 *
 * Null rather than a number when there is nothing to compare against: the
 * dashboard used to show a hard-coded "+100%" badge next to any non-zero
 * figure, which told a practice it had doubled its income on the strength of
 * having earned anything at all. Growth from zero has no percentage, so that
 * case is null too.
 */
export function changePercent(series: MonthlyRevenue[]): number | null {
  if (series.length < 2) return null;
  const current = BigInt(series[series.length - 1].revenueKobo);
  const previous = BigInt(series[series.length - 2].revenueKobo);
  if (previous === 0n) return null;
  return Math.round((Number(current - previous) / Number(previous)) * 100);
}
