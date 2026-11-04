/**
 * What the Schedule shows, from real data instead of fixed numbers: the hours
 * span your weekly availability and any session in view (at least 8 AM to
 * 6 PM), the week shows Saturday or Sunday only when you work them or have a
 * session then, and each service keeps one colour.
 */
export interface WeeklyTimeLite {
  /** 0 = Monday … 6 = Sunday (TherapistWeeklyTime). */
  weekday: number;
  /** 'HH:MM', practice time. */
  start: string;
}

export interface TimedEvent {
  startsAt: string;
  endsAt: string;
  type: string;
}

const DEFAULT_START = 8;
const DEFAULT_END = 18;

export function visibleHours(events: TimedEvent[], weekly: WeeklyTimeLite[], sessionLengthMinutes = 50): { startHour: number; endHour: number } {
  let start = DEFAULT_START;
  let end = DEFAULT_END;
  for (const w of weekly) {
    const [h, m] = w.start.split(':').map(Number);
    if (!Number.isFinite(h)) continue;
    start = Math.min(start, h);
    end = Math.max(end, Math.ceil((h * 60 + (m || 0) + sessionLengthMinutes) / 60));
  }
  for (const e of events) {
    const s = new Date(e.startsAt);
    const f = new Date(e.endsAt);
    start = Math.min(start, s.getHours());
    // An event ending at midnight or later the next day fills to the end of the day.
    const endHour = f.getDate() !== s.getDate() ? 24 : Math.ceil((f.getHours() * 60 + f.getMinutes()) / 60);
    end = Math.max(end, endHour);
  }
  return { startHour: Math.max(0, start), endHour: Math.min(24, Math.max(end, start + 1)) };
}

/** Monday-based weekday index (0 = Monday) of a date. */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

/** Monday to Friday, plus Saturday and Sunday when you work them or have a session on them that week. */
export function visibleDays(weekStart: Date, events: TimedEvent[], weekly: WeeklyTimeLite[]): Date[] {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const weekendWorked = new Set(weekly.map((w) => w.weekday).filter((d) => d >= 5));
  for (const e of events) {
    const s = new Date(e.startsAt);
    const idx = mondayIndex(s);
    if (idx >= 5 && s >= days[0] && s < new Date(days[6].getFullYear(), days[6].getMonth(), days[6].getDate() + 1)) weekendWorked.add(idx);
  }
  return days.filter((_, i) => i < 5 || weekendWorked.has(i));
}

/** Readable, distinct colours; a service keeps its colour by name, whatever else is on screen. */
const SERVICE_COLOURS = ['#0F3A53', '#B45309', '#047857', '#7C3AED', '#BE123C', '#0369A1', '#4D7C0F', '#A21CAF'];

export function serviceColour(serviceTitle: string, brand?: string): string {
  if (!serviceTitle) return '#64748B';
  let hash = 0;
  for (const ch of serviceTitle.trim().toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const palette = brand ? [brand, ...SERVICE_COLOURS.slice(1)] : SERVICE_COLOURS;
  return palette[hash % palette.length];
}

/** The services on screen, for the colour key. */
export function servicesInView(events: TimedEvent[]): string[] {
  return [...new Set(events.map((e) => e.type).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
