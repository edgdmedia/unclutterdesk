/** BKG-09: how long an unpaid online booking keeps its time. Paystack's
 *  pay-with-transfer account lives 30 minutes; 5 more cover a slow webhook. */
export const ONLINE_HOLD_MINUTES = 35;

/** If Paystack can't be asked, a hold waits at most this long past expiry. */
export const RELEASE_GRACE_MS = 2 * 60 * 60 * 1000;

export function onlineHoldExpiry(now: Date, startsAt: Date): Date {
  const hold = new Date(now.getTime() + ONLINE_HOLD_MINUTES * 60_000);
  return hold < startsAt ? hold : startsAt;
}
