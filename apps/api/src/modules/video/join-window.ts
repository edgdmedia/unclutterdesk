/**
 * VID-01 / VID-02: when a session's room can be entered. One rule for the
 * server's check and for the Join buttons, so they never disagree.
 */
export const JOIN_OPENS_MINUTES_BEFORE = 15;
export const JOIN_CLOSES_MINUTES_AFTER = 60;

export interface RoomWindowTimes { opensAt: Date; closesAt: Date }

export function joinWindow(startsAt: Date, endsAt: Date): RoomWindowTimes {
  return {
    opensAt: new Date(startsAt.getTime() - JOIN_OPENS_MINUTES_BEFORE * 60_000),
    closesAt: new Date(endsAt.getTime() + JOIN_CLOSES_MINUTES_AFTER * 60_000),
  };
}
