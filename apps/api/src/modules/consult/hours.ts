const LAGOS_OFFSET_MIN = 60; // Africa/Lagos is UTC+1, no DST
const DAY_MS = 86_400_000;

export interface WeeklyTime { weekday: number; start: string; allowsOnline: boolean; allowsInPerson: boolean; locationId: bigint | null }
export interface GeneratedSlot { startsAt: Date; endsAt: Date; allowsOnline: boolean; allowsInPerson: boolean; locationId: bigint | null }

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/** The session start times that fit in working hours, for laying out tiles. */
export function timesInHours(start: string, end: string, sessionLengthMinutes: number, gapMinutes: number): string[] {
  const out: string[] = [];
  for (let t = minutes(start); t + sessionLengthMinutes <= minutes(end); t += sessionLengthMinutes + gapMinutes) out.push(hhmm(t));
  return out;
}

/** Midnight in Lagos of the Lagos calendar day containing `at`, as a UTC Date. */
function lagosMidnight(at: Date): Date {
  const local = new Date(at.getTime() + LAGOS_OFFSET_MIN * 60_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - LAGOS_OFFSET_MIN * 60_000);
}

/**
 * Dated slots from the weekly pattern, in Lagos time, independent of the
 * server's TZ. `isTaken` covers booked slots and one-off changes, so a saved
 * pattern never duplicates or clobbers them. A time that has already started
 * is past and never offered.
 */
export function slotsFromPattern(
  times: WeeklyTime[],
  opts: { now: Date; days: number; sessionLengthMinutes: number; isTaken: (s: Date, e: Date) => boolean },
): GeneratedSlot[] {
  const out: GeneratedSlot[] = [];
  const first = lagosMidnight(opts.now);
  for (let d = 0; d <= opts.days; d++) {
    const dayStart = new Date(first.getTime() + d * DAY_MS);
    const lagosDay = new Date(dayStart.getTime() + LAGOS_OFFSET_MIN * 60_000).getUTCDay(); // 0 = Sunday
    const weekday = lagosDay === 0 ? 6 : lagosDay - 1;
    for (const t of times.filter((x) => x.weekday === weekday).sort((a, b) => minutes(a.start) - minutes(b.start))) {
      const s = new Date(dayStart.getTime() + minutes(t.start) * 60_000);
      const e = new Date(s.getTime() + opts.sessionLengthMinutes * 60_000);
      if (s >= opts.now && !opts.isTaken(s, e)) {
        out.push({ startsAt: s, endsAt: e, allowsOnline: t.allowsOnline, allowsInPerson: t.allowsInPerson, locationId: t.locationId });
      }
    }
  }
  return out;
}
