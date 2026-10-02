/**
 * VID-01 / VID-02: when a session's room can be entered. The app's Join buttons
 * use this; the API keeps the same numbers in modules/video/join-window.ts,
 * and a test there fails if the two ever differ.
 */
export const JOIN_OPENS_MINUTES_BEFORE = 15;
export const JOIN_CLOSES_MINUTES_AFTER = 60;

export function joinWindow(startsAt: Date, endsAt: Date): { opensAt: Date; closesAt: Date } {
  return {
    opensAt: new Date(startsAt.getTime() - JOIN_OPENS_MINUTES_BEFORE * 60_000),
    closesAt: new Date(endsAt.getTime() + JOIN_CLOSES_MINUTES_AFTER * 60_000),
  };
}

export type JoinState = 'early' | 'open' | 'over';

export function joinState(now: Date, startsAt: Date, endsAt: Date): JoinState {
  const { opensAt, closesAt } = joinWindow(startsAt, endsAt);
  if (now < opensAt) return 'early';
  if (now > closesAt) return 'over';
  return 'open';
}
