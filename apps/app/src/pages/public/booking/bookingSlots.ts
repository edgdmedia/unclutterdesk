/** A bookable time from `GET /v1/consult/public/availability`. */
export type Slot = {
  id: string;
  serviceId: string | null;
  providerProfileId?: string;
  therapistName: string;
  therapistTitle?: string | null;
  avatarUrl?: string | null;
  startsAt: string;
  endsAt: string;
  channel: string;
};

export type Format = 'Online' | 'In person';

/** Practices are in Nigeria; clients book in the practice's time, wherever their browser is. */
const ZONE = 'Africa/Lagos';
/** How far ahead the wizard shows times. */
export const WINDOW_DAYS = 28;

const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFormat = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hour: 'numeric', minute: '2-digit', hour12: true });
const shortDay = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, day: 'numeric', month: 'short' });

/** Slots made before formats existed are all video, so anything else reads as online. */
export function formatOf(channel: string | null | undefined): Format {
  return channel === 'IN_PERSON' ? 'In person' : 'Online';
}

/** 'YYYY-MM-DD' of the instant in West Africa Time. */
export function dayKeyWAT(iso: string | Date): string {
  return dayKeyFormat.format(typeof iso === 'string' ? new Date(iso) : iso);
}

export function timeLabelWAT(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** Noon UTC on that day: safe for adding days without slipping across a date line. */
function noonOf(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

export function addDays(key: string, days: number): string {
  const d = noonOf(key);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The seven days of week `weekIndex`, where week 0 starts today in WAT. */
export function weekDays(today: Date, weekIndex: number): string[] {
  const start = addDays(dayKeyWAT(today), weekIndex * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function weekLabel(days: string[]): string {
  return `${shortDay.format(noonOf(days[0]))} – ${shortDay.format(noonOf(days[days.length - 1]))}`;
}

/** Slots open to any service, plus those set aside for this one. */
export function slotsForService(slots: Slot[], serviceId: string | null): Slot[] {
  return slots.filter((s) => s.serviceId === null || s.serviceId === serviceId);
}

export function slotsOnDay(slots: Slot[], day: string, filter: 'All' | Format): Slot[] {
  return slots.filter((s) => dayKeyWAT(s.startsAt) === day && (filter === 'All' || formatOf(s.channel) === filter));
}

export function formatsOffered(slots: Slot[]): Format[] {
  const seen = new Set(slots.map((s) => formatOf(s.channel)));
  return (['Online', 'In person'] as Format[]).filter((f) => seen.has(f));
}

/** The first day after `afterDay` that has a time, or null. */
export function nextDayWithSlots(slots: Slot[], afterDay: string): string | null {
  const days = slots.map((s) => dayKeyWAT(s.startsAt)).filter((d) => d > afterDay).sort();
  return days[0] ?? null;
}
