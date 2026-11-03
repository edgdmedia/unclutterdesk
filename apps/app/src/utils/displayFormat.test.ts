import { describe, expect, it } from 'vitest';
import { DEFAULT_DISPLAY, formatClock, formatDate, formatDayLabel, formatTime, formatWhen, setActiveDisplayPrefs } from './displayFormat';

const lagos = DEFAULT_DISPLAY;
const at = new Date('2026-11-04T14:05:00Z'); // 3:05 pm in Lagos

describe('display format (Settings → Preferences)', () => {
  it('follows the chosen clock', () => {
    expect(formatTime(at, { ...lagos, timeFormat: '12-hour' })).toMatch(/^3:05\s?(pm|PM)$/);
    expect(formatTime(at, { ...lagos, timeFormat: '24-hour' })).toBe('15:05');
  });

  it('follows the chosen date format and time zone', () => {
    expect(formatDate(at, { ...lagos, dateFormat: 'DD/MM/YYYY' })).toBe('04/11/2026');
    expect(formatDate(at, { ...lagos, dateFormat: 'YYYY-MM-DD' })).toBe('2026-11-04');
    // 11:30 pm UTC is already the next day in Lagos.
    expect(formatDate(new Date('2026-11-04T23:30:00Z'), { ...lagos, dateFormat: 'YYYY-MM-DD' })).toBe('2026-11-05');
  });

  it('names today and tomorrow in the person\'s own time zone', () => {
    const now = new Date('2026-11-04T08:00:00Z');
    expect(formatDayLabel(at, now, lagos)).toBe('Today');
    expect(formatDayLabel(new Date('2026-11-05T09:00:00Z'), now, lagos)).toBe('Tomorrow');
    expect(formatDayLabel(new Date('2026-11-07T09:00:00Z'), now, lagos)).toMatch(/Sat/);
  });

  it('list and dialog helpers follow the signed-in person\'s current preferences', () => {
    setActiveDisplayPrefs({ ...lagos, timeFormat: '24-hour' });
    expect(formatClock(at)).toBe('15:05');
    expect(formatWhen(at, 'short')).toMatch(/15:05$/);
    setActiveDisplayPrefs({ ...lagos, timeFormat: '12-hour' });
    expect(formatWhen(at, 'long')).toMatch(/Wednesday.*3:05\s?(pm|PM)$/);
    setActiveDisplayPrefs(DEFAULT_DISPLAY);
  });
});
