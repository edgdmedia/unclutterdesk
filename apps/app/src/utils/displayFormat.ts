import useSWR from 'swr';
import { api } from './apiClient';

/**
 * How the signed-in person wants dates and times shown (Settings →
 * Preferences, GET /v1/auth/preferences). Every page that shows a date or
 * time formats it through here, so the preference holds everywhere.
 */
export type DateFmt = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'D MMM YYYY';
export type TimeFmt = '24-hour' | '12-hour';

export interface DisplayPrefs {
  locale: string;
  timezone: string;
  dateFormat: DateFmt;
  timeFormat: TimeFmt;
}

export const PREFERENCES_KEY = '/v1/auth/preferences';

/** Until the preferences load (or if they can't): West Africa time, 12-hour clock. */
export const DEFAULT_DISPLAY: DisplayPrefs = { locale: 'en-NG', timezone: 'Africa/Lagos', dateFormat: 'D MMM YYYY', timeFormat: '12-hour' };

export function formatTime(date: Date, p: DisplayPrefs): string {
  return new Intl.DateTimeFormat(p.locale, { timeZone: p.timezone, hour: p.timeFormat === '12-hour' ? 'numeric' : '2-digit', minute: '2-digit', hour12: p.timeFormat === '12-hour' }).format(date);
}

export function formatDate(date: Date, p: DisplayPrefs): string {
  const parts = new Intl.DateTimeFormat(p.locale, { timeZone: p.timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  switch (p.dateFormat) {
    case 'DD/MM/YYYY':
      return `${parts.day}/${parts.month}/${parts.year}`;
    case 'MM/DD/YYYY':
      return `${parts.month}/${parts.day}/${parts.year}`;
    case 'YYYY-MM-DD':
      return `${parts.year}-${parts.month}-${parts.day}`;
    default:
      return new Intl.DateTimeFormat(p.locale, { timeZone: p.timezone, day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }
}

/** The calendar day of `date` in the person's time zone, as YYYY-MM-DD, for comparing days. */
function dayKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** "Today", "Tomorrow", or a short day and date such as "Wed 5 Nov", in the person's time zone. */
export function formatDayLabel(date: Date, now: Date, p: DisplayPrefs): string {
  const day = dayKey(date, p.timezone);
  if (day === dayKey(now, p.timezone)) return 'Today';
  if (day === dayKey(new Date(now.getTime() + 86_400_000), p.timezone)) return 'Tomorrow';
  return new Intl.DateTimeFormat(p.locale, { timeZone: p.timezone, weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

/** The person's display preferences, with formatters bound to them. */
export function useDisplayFormat() {
  const { data } = useSWR<Partial<DisplayPrefs>>(PREFERENCES_KEY, (key: string) => api.get<Partial<DisplayPrefs>>(key), { revalidateOnFocus: false });
  const prefs: DisplayPrefs = { ...DEFAULT_DISPLAY, ...pick(data) };
  return {
    prefs,
    time: (d: Date | string) => formatTime(new Date(d), prefs),
    date: (d: Date | string) => formatDate(new Date(d), prefs),
    day: (d: Date | string, now = new Date()) => formatDayLabel(new Date(d), now, prefs),
  };
}

function pick(data: Partial<DisplayPrefs> | undefined): Partial<DisplayPrefs> {
  if (!data) return {};
  const out: Partial<DisplayPrefs> = {};
  if (data.locale) out.locale = data.locale;
  if (data.timezone) out.timezone = data.timezone;
  if (data.dateFormat) out.dateFormat = data.dateFormat;
  if (data.timeFormat) out.timeFormat = data.timeFormat;
  return out;
}

/*
 * The signed-in person's preferences for code that formats outside a
 * component (list helpers, dialogs). <DisplayPrefsSync/> in the practice
 * frame keeps this current; until it loads, the defaults apply.
 */
let active: DisplayPrefs = DEFAULT_DISPLAY;
export function setActiveDisplayPrefs(p: DisplayPrefs): void {
  active = p;
}
export function activeDisplayPrefs(): DisplayPrefs {
  return active;
}

export type WhenStyle = 'short' | 'long' | 'withYear';

/** A date and time in the person's own format, e.g. "Wed 5 Nov, 3:00 pm" (short), "Wednesday 5 November, 3:00 pm" (long). */
export function formatWhen(value: Date | string, style: WhenStyle = 'short', p: DisplayPrefs = active): string {
  const d = new Date(value);
  const day =
    style === 'withYear'
      ? formatDate(d, p)
      : new Intl.DateTimeFormat(p.locale, {
          timeZone: p.timezone,
          weekday: style === 'long' ? 'long' : 'short',
          day: 'numeric',
          month: style === 'long' ? 'long' : 'short',
        }).format(d);
  return `${day}, ${formatTime(d, p)}`;
}

/** Just the time, in the person's clock. */
export function formatClock(value: Date | string, p: DisplayPrefs = active): string {
  return formatTime(new Date(value), p);
}
