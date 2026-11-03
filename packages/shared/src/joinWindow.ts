/**
 * VID-01 / VID-02: when a session's room can be entered. The app's Join buttons
 * use this; the API keeps the same numbers in modules/video/join-window.ts,
 * and a test there fails if the two ever differ.
 */
/** The practice chooses how early a session's room opens; closing is fixed. */
export const JOIN_OPENS_CHOICES = [0, 5, 10, 15] as const;
export const DEFAULT_JOIN_OPENS_MINUTES = 10;
export const JOIN_CLOSES_MINUTES_AFTER = 60;

/** A stored setting, or the default when it is missing or not one of the choices. */
export function joinOpensMinutes(value: unknown): number {
  return typeof value === 'number' && (JOIN_OPENS_CHOICES as readonly number[]).includes(value) ? value : DEFAULT_JOIN_OPENS_MINUTES;
}

export function joinWindow(startsAt: Date, endsAt: Date, opensMinutesBefore: number = DEFAULT_JOIN_OPENS_MINUTES): { opensAt: Date; closesAt: Date } {
  return {
    opensAt: new Date(startsAt.getTime() - joinOpensMinutes(opensMinutesBefore) * 60_000),
    closesAt: new Date(endsAt.getTime() + JOIN_CLOSES_MINUTES_AFTER * 60_000),
  };
}

export type JoinState = 'early' | 'open' | 'over';

export function joinState(now: Date, startsAt: Date, endsAt: Date, opensMinutesBefore: number = DEFAULT_JOIN_OPENS_MINUTES): JoinState {
  const { opensAt, closesAt } = joinWindow(startsAt, endsAt, opensMinutesBefore);
  if (now < opensAt) return 'early';
  if (now > closesAt) return 'over';
  return 'open';
}
