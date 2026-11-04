import { useEffect, useMemo, useState } from 'react';
import { activeDisplayPrefs, formatTime } from '../../utils/displayFormat';

export interface PickableSlot {
  id: string;
  startsAt: string;
  endsAt?: string;
}

/**
 * Open times as days, then the times on the chosen day. A practitioner's
 * month of slots listed one per row ran to hundreds of rows; this shows one
 * row of days and only that day's times. Shared by staff booking and
 * rescheduling (staff and client), so they cannot drift.
 */
export function SlotDayPicker({
  slots,
  value,
  onChange,
  name,
  accent,
}: {
  slots: PickableSlot[];
  value: string;
  onChange: (slot: PickableSlot) => void;
  /** The radio group name; unique per dialog. */
  name: string;
  /** The practice's colour on client pages; the dashboard primary otherwise. */
  accent?: string;
}) {
  const prefs = activeDisplayPrefs();
  const dayKey = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: prefs.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }),
    [prefs.timezone],
  );
  const dayLabel = useMemo(
    () => new Intl.DateTimeFormat(prefs.locale, { timeZone: prefs.timezone, weekday: 'short', day: 'numeric', month: 'short' }),
    [prefs.locale, prefs.timezone],
  );

  const days = useMemo(() => {
    const byDay = new Map<string, PickableSlot[]>();
    for (const s of [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
      const k = dayKey.format(new Date(s.startsAt));
      byDay.set(k, [...(byDay.get(k) ?? []), s]);
    }
    return [...byDay.entries()].map(([key, times]) => ({ key, label: dayLabel.format(new Date(times[0].startsAt)), times }));
  }, [slots, dayKey, dayLabel]);

  const chosenDay = value ? days.find((d) => d.times.some((t) => t.id === value))?.key : undefined;
  const [day, setDay] = useState<string>(chosenDay ?? days[0]?.key ?? '');
  // A new list (another service or practitioner) starts on its first day.
  useEffect(() => {
    if (!days.some((d) => d.key === day)) setDay(chosenDay ?? days[0]?.key ?? '');
  }, [days, day, chosenDay]);

  const times = days.find((d) => d.key === day)?.times ?? [];
  const ring = accent ?? 'var(--desk-pine-600)';

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Day" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {days.map((d) => {
          const on = d.key === day;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={on}
              onClick={() => setDay(d.key)}
              className={`flex-none flex flex-col items-center justify-center min-w-[72px] h-[54px] px-2 rounded-[12px] border text-center cursor-pointer ${
                on ? 'bg-[var(--desk-surface-alt)]' : 'border-[var(--desk-border)] hover:bg-[var(--desk-surface)]'
              }`}
              style={on ? { borderColor: ring, boxShadow: `inset 0 0 0 1px ${ring}` } : undefined}
            >
              <span className="text-[12.5px] font-bold text-[var(--desk-text)]">{d.label}</span>
              <span className="text-[11px] text-[var(--desk-text-muted)]">{d.times.length} {d.times.length === 1 ? 'time' : 'times'}</span>
            </button>
          );
        })}
      </div>

      <fieldset className="grid grid-cols-3 @min-[420px]:grid-cols-4 gap-2">
        <legend className="sr-only">Time</legend>
        {times.map((t) => {
          const on = t.id === value;
          const label = formatTime(new Date(t.startsAt), prefs);
          return (
            <label
              key={t.id}
              data-testid={`slot-${t.id}`}
              className={`flex items-center justify-center h-[40px] rounded-[12px] border cursor-pointer text-[13px] font-semibold text-[var(--desk-text)] ${
                on ? 'bg-[var(--desk-surface-alt)]' : 'border-[var(--desk-border)] hover:bg-[var(--desk-surface)]'
              }`}
              style={on ? { borderColor: ring, boxShadow: `inset 0 0 0 1px ${ring}` } : undefined}
            >
              <input
                type="radio"
                name={name}
                value={t.id}
                checked={on}
                onChange={() => onChange(t)}
                className="sr-only"
                aria-label={`${dayLabel.format(new Date(t.startsAt))}, ${label}`}
              />
              {label}
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}
