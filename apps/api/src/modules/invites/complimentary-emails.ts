/**
 * The emails a complimentary plan sends (spec §5.4). A migration can't send
 * email, so the hourly invite cron queues them through NotificationDispatch,
 * each under a dedupe key built here: re-running the cron never sends twice,
 * and anything that ends the period early (a payment, the INTERNAL script)
 * cancels them all through the shared prefix.
 */
export type ComplimentaryStep = 'granted' | 'reminder14' | 'reminder3';

/** Every key for one practice's period starts with this. */
export function complimentaryPrefix(tenantId: bigint, until: Date): string {
  return `complimentary:${tenantId}:${until.toISOString().slice(0, 10)}:`;
}

/** One key per practice, period end, step and owner. */
export function complimentaryKey(tenantId: bigint, until: Date, step: ComplimentaryStep, ownerId: bigint): string {
  return `${complimentaryPrefix(tenantId, until)}${step}:${ownerId}`;
}
