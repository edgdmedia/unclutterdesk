/**
 * Changing a booked session's service (plan 2026-11-04-change-session-service).
 *
 * The money rule, kept apart from the database so every case is tested:
 *
 * - Not yet paid: the price to pay simply becomes the new service's price.
 * - Already paid, settled by the desk, or free: what the client paid stands.
 *   If the new service costs more, the difference is a balance DUE, which the
 *   desk later records as paid or waives. If it costs less, nothing is owed and
 *   the overpayment is reported, because refunds are made by hand.
 *
 * Each change recomputes from `amountKobo`, which is everything collected so
 * far (a balance recorded as paid is folded into it), so changing twice never
 * double-counts.
 */
export interface MoneyBefore {
  status: string;
  paidAt?: Date | null;
  amountKobo?: bigint | null;
}

export interface MoneyAfter {
  amountKobo: bigint;
  balanceKobo: bigint | null;
  balanceStatus: 'DUE' | null;
  /** Paid above the new price; the desk refunds it by hand if it agrees to. */
  overpaidKobo: bigint;
}

export function isUnpaid(b: MoneyBefore): boolean {
  return b.status === 'PENDING_PAYMENT' && !b.paidAt;
}

export function moneyAfterServiceChange(b: MoneyBefore, newPriceKobo: bigint): MoneyAfter {
  if (isUnpaid(b)) {
    return { amountKobo: newPriceKobo, balanceKobo: null, balanceStatus: null, overpaidKobo: 0n };
  }
  const paid = b.amountKobo ?? 0n;
  const diff = newPriceKobo - paid;
  return {
    amountKobo: paid,
    balanceKobo: diff > 0n ? diff : null,
    balanceStatus: diff > 0n ? 'DUE' : null,
    overpaidKobo: diff < 0n ? -diff : 0n,
  };
}
