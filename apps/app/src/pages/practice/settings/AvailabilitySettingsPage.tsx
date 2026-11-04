import React, { useEffect, useMemo, useState } from 'react';
import { Info, Plus, Save } from 'lucide-react';
import { Button, Card, Eyebrow, Page, PageHeader, SegmentedControl, useToast } from '@unclutterdesk/ui';
import { api } from '../../../utils/apiClient';
import { useSearchParams } from 'react-router-dom';
import { formatClock } from '../../../utils/displayFormat';
import { VideoRoomOpensSetting } from '../../../components/settings/VideoRoomOpensSetting';

type Format = 'ONLINE' | 'IN_PERSON';
type Window = { start: string; end: string };
type WeeklyTime = { weekday: number; start: string; formats: Format[]; locationId: string | null };
type SlotView = {
  id: string; startsAt: string; endsAt: string; isActive: boolean;
  formats: Format[]; location: { id: string; name: string } | null; customised: boolean; booked: boolean;
};
type TimeOff = {
  id: string;
  startsOn: string;
  endsOn: string;
  note: string | null;
};

type TimeOffView = TimeOff & {
  bookings: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    clientName: string;
    serviceTitle: string;
    status: string;
  }>;
};

type Payload = {
  cancellationHours: number;
  sessionLengthMinutes: number;
  gapMinutes: number;
  locations: Array<{ id: string; name: string; city: string }>;
  weeklyTimes: WeeklyTime[];
  slots: SlotView[];
  timeOff: TimeOff[];
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = (typeof DAY_KEYS)[number];

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/** The session times that fit in a day's windows — the same layout rule the server uses. */
function timesInHours(windows: Window[], length: number, gap: number): string[] {
  const out: string[] = [];
  for (const w of windows) {
    for (let t = minutes(w.start); t + length <= minutes(w.end); t += length + gap) out.push(hhmm(t));
  }
  return [...new Set(out)].sort((a, b) => minutes(a) - minutes(b));
}

function formatLabel(t: WeeklyTime, locations: Payload['locations']): string {
  const where = t.locationId ? locations.find((l) => l.id === t.locationId)?.name : null;
  if (t.formats.includes('ONLINE') && t.formats.includes('IN_PERSON')) return `Either${where ? ` · ${where}` : ''}`;
  if (t.formats.includes('IN_PERSON')) return `In person${where ? ` · ${where}` : ''}`;
  return 'Online';
}

function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange} className="w-[40px] h-[22px] rounded-full relative transition-colors cursor-pointer shrink-0" style={{ backgroundColor: on ? '#15803D' : '#E2E8F0' }}>
      <span className="absolute top-[3px] h-[16px] w-[16px] rounded-full bg-white shadow-[0_2px_5px_rgba(15,23,42,0.2)] transition-[left] duration-150" style={{ left: on ? '21px' : '3px' }} />
    </button>
  );
}

/** SET-06: the repeating week, each time with its own format and location. */
/**
 * One session-time tile. A module-level component (not defined inside the
 * page) so a parent re-render never remounts it out from under an open menu.
 */
function Tile(props: {
  id: string;
  formats: Format[];
  locationId: string | null;
  onPick: (f: Format[], l: string | null) => void;
  locked?: boolean;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  locations: Array<{ id: string; name: string; city: string }>;
}) {
  const { id, formats, locationId, onPick, locked, badge, open, onToggle, locations } = props;
  const label = formatLabel({ weekday: 0, start: '', formats, locationId } as WeeklyTime, locations);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={locked}
        aria-label={`${locked ? 'Booked time' : 'Format'} ${label}${badge ? ` (${badge})` : ''}`}
        onClick={onToggle}
        className={`h-[34px] px-3 rounded-[10px] border text-[12.5px] font-bold ${locked ? 'border-[var(--desk-border)] bg-[var(--desk-surface-muted)] text-[var(--desk-text-subtle)] cursor-not-allowed' : 'border-[var(--desk-border)] bg-white text-[var(--desk-text)] cursor-pointer hover:border-[var(--desk-pine-600)]'}`}
      >
        {label}{badge ? <span className="ml-1.5 text-[10px] font-black uppercase text-[var(--desk-pending)]">{badge}</span> : null}
      </button>
      {open && !locked ? (
        <div role="menu" className="absolute left-0 top-full mt-1 z-20 w-[230px] rounded-[14px] border border-[var(--desk-border)] bg-white shadow-xl p-2 space-y-1.5">
          {([['Online', ['ONLINE'] as Format[]], ['In person', ['IN_PERSON'] as Format[]], ['Either', ['ONLINE', 'IN_PERSON'] as Format[]]] as const).map(([name, fs]) => (
            <button
              key={name}
              type="button"
              role="menuitem"
              onClick={() => onPick(fs, fs.includes('IN_PERSON') ? (locationId ?? locations[0]?.id ?? null) : null)}
              className="w-full text-left px-2.5 h-[32px] rounded-[9px] text-[13px] font-semibold hover:bg-[var(--desk-surface-muted)] cursor-pointer"
            >
              {name}
            </button>
          ))}
          {locations.length ? (
            <label className="block text-[11px] font-bold text-[var(--desk-text-body)]">
              Location
              <select
                className="mt-1 w-full h-[34px] rounded-[9px] border border-[var(--desk-border)] bg-[var(--desk-surface)] px-2 text-[12.5px] font-semibold"
                value={locationId ?? ''}
                onChange={(e) => {
                  const loc = e.target.value || null;
                  const fs: Format[] = loc ? (formats.includes('ONLINE') ? ['ONLINE', 'IN_PERSON'] : ['IN_PERSON']) : ['ONLINE'];
                  onPick(fs, loc);
                }}
              >
                <option value="">None (online only)</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
          ) : null}
          <button type="button" onClick={onToggle} className="w-full text-left px-2.5 h-[30px] rounded-[9px] text-[12.5px] font-semibold text-[var(--desk-text-muted)] hover:bg-[var(--desk-surface-muted)] cursor-pointer">Close</button>
        </div>
      ) : null}
    </div>
  );
}

export function AvailabilitySettingsPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') === 'upcoming' ? 'upcoming' : 'weekly') as 'weekly' | 'upcoming';
  const [tab, setTab] = useState<'weekly' | 'upcoming' | 'timeoff'>(initialTab as 'weekly' | 'upcoming' | 'timeoff');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Payload['locations']>([]);
  const [slots, setSlots] = useState<SlotView[]>([]);
  const [days, setDays] = useState<Record<DayKey, { on: boolean; windows: Window[] }>>(
    Object.fromEntries(DAY_KEYS.map((k) => [k, { on: false, windows: [] }])) as never,
  );
  const [times, setTimes] = useState<Record<string, { formats: Format[]; locationId: string | null }>>({});
  const [sessionLengthMinutes, setSessionLengthMinutes] = useState(50);
  const [gapMinutes, setGapMinutes] = useState(10);
  const [cancellationHours, setCancellationHours] = useState(24);
  const [openChooser, setOpenChooser] = useState<string | null>(null);
  const [timeOff, setTimeOff] = useState<TimeOffView[]>([]);
  const [moving, setMoving] = useState<{ bookingId: string; clientName: string; slots: SlotView[] } | null>(null);
  const [movingSaving, setMovingSaving] = useState(false);

  // Sync tab to URL
  React.useEffect(() => {
    setSearchParams((prev) => {
      prev.set('tab', tab);
      return prev;
    }, { replace: true });
  }, [tab, setSearchParams]);

  function apply(payload: Payload) {
    setLocations(payload.locations ?? []);
    setSlots(payload.slots ?? []);
    setSessionLengthMinutes(payload.sessionLengthMinutes ?? 50);
    setGapMinutes(payload.gapMinutes ?? 10);
    setCancellationHours(payload.cancellationHours ?? 24);
    const length = payload.sessionLengthMinutes ?? 50;
    const nextDays = Object.fromEntries(DAY_KEYS.map((k) => [k, { on: false, windows: [] as Window[] }])) as Record<DayKey, { on: boolean; windows: Window[] }>;
    const nextTimes: Record<string, { formats: Format[]; locationId: string | null }> = {};
    for (const t of payload.weeklyTimes ?? []) {
      nextTimes[`${t.weekday}|${t.start}`] = { formats: t.formats, locationId: t.locationId };
      const day = nextDays[DAY_KEYS[t.weekday]];
      day.on = true;
      const start = minutes(t.start);
      const end = start + length;
      const w = day.windows[0];
      day.windows = w ? [{ start: hhmm(Math.min(minutes(w.start), start)), end: hhmm(Math.max(minutes(w.end), end)) }] : [{ start: hhmm(start), end: hhmm(end) }];
    }
    setDays(nextDays);
    setTimes(nextTimes);
  }

  useEffect(() => {
    let cancelled = false;
    api.get<Payload>('/v1/consult/therapist/availability')
      .then((payload) => { if (!cancelled) apply(payload); })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Unable to load availability'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  /** Loads the time-off periods and groups the sessions already on those days. */
  async function loadTimeOff() {
    const result = await api.get<{ timeOff: TimeOff[]; bookings: Array<{ id: string; startsAt: string; endsAt: string; clientName: string; serviceTitle: string; status: string }> }>('/v1/consult/therapist/time-off');
    const enriched = result.timeOff.map((t) => ({
      ...t,
      bookings: result.bookings.filter((b) => {
        const slotDay = new Date(b.startsAt).toISOString().slice(0, 10);
        return slotDay >= t.startsOn && slotDay <= t.endsOn;
      }),
    }));
    setTimeOff(enriched);
    return enriched;
  }

  useEffect(() => {
    loadTimeOff().catch(() => undefined);
  }, []);

  const dayTimes = useMemo(() => {
    const out: Array<{ weekday: number; start: string }> = [];
    DAY_KEYS.forEach((key, weekday) => {
      const day = days[key];
      if (!day.on) return;
      for (const start of timesInHours(day.windows, sessionLengthMinutes, gapMinutes)) out.push({ weekday, start });
    });
    return out;
  }, [days, sessionLengthMinutes, gapMinutes]);

  // New times copy the nearest earlier time's format, or Online.
  useEffect(() => {
    setTimes((prev) => {
      const next = { ...prev };
      for (const { weekday, start } of dayTimes) {
        const id = `${weekday}|${start}`;
        if (next[id]) continue;
        const earlier = dayTimes.filter((t) => t.weekday === weekday && minutes(t.start) < minutes(start)).sort((a, b) => minutes(b.start) - minutes(a.start))[0];
        const source = earlier ? next[`${earlier.weekday}|${earlier.start}`] : null;
        next[id] = source ? { ...source } : { formats: ['ONLINE'], locationId: null };
      }
      for (const k of Object.keys(next)) {
        if (!dayTimes.some((t) => `${t.weekday}|${t.start}` === k)) delete next[k];
      }
      return next;
    });
  }, [dayTimes]);

  const toggleDay = (key: DayKey) => setDays((prev) => ({ ...prev, [key]: { ...prev[key], on: !prev[key].on, windows: prev[key].windows.length ? prev[key].windows : [{ start: '09:00', end: '17:00' }] } }));
  const addWindow = (key: DayKey) => setDays((prev) => ({ ...prev, [key]: { ...prev[key], windows: [...prev[key].windows, { start: '09:00', end: '12:00' }] } }));
  const setWindow = (key: DayKey, index: number, field: 'start' | 'end', value: string) => setDays((prev) => ({ ...prev, [key]: { ...prev[key], windows: prev[key].windows.map((w, i) => (i === index ? { ...w, [field]: value } : w)) } }));
  const removeWindow = (key: DayKey, index: number) => setDays((prev) => ({ ...prev, [key]: { ...prev[key], windows: prev[key].windows.filter((_, i) => i !== index) } }));

  function setTime(id: string, formats: Format[], locationId: string | null) {
    setTimes((prev) => ({ ...prev, [id]: { formats, locationId } }));
    setOpenChooser(null);
  }

  function setAllDay(weekday: number, formats: Format[], locationId: string | null) {
    setTimes((prev) => {
      const next = { ...prev };
      for (const t of dayTimes.filter((x) => x.weekday === weekday)) next[`${t.weekday}|${t.start}`] = { formats, locationId };
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const weeklyTimes = dayTimes.map((t) => ({
        weekday: t.weekday,
        start: t.start,
        formats: times[`${t.weekday}|${t.start}`]?.formats ?? ['ONLINE'],
        locationId: times[`${t.weekday}|${t.start}`]?.locationId ?? null,
      }));
      const payload = await api.patch<Payload>('/v1/consult/therapist/availability', { weeklyTimes, sessionLengthMinutes, gapMinutes, cancellationHours });
      apply(payload);
      toast.success('Availability saved. Open times updated; booked sessions and this-date-only changes stay as they are.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save availability';
      toast.error(message);
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function changeSlot(slot: SlotView, formats: Format[], locationId: string | null) {
    setError(null);
    try {
      await api.patch(`/v1/consult/therapist/slots/${slot.id}`, { formats, locationId });
      const payload = await api.get<Payload>('/v1/consult/therapist/availability');
      apply(payload);
      toast.success('That time updated for this date only.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'That time could not be changed';
      toast.error(message);
      setError(message);
    }
  }

  async function resetSlot(slot: SlotView) {
    try {
      await api.patch(`/v1/consult/therapist/slots/${slot.id}`, { reset: true });
      const payload = await api.get<Payload>('/v1/consult/therapist/availability');
      apply(payload);
      toast.success('Back to the weekly pattern.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That time could not be reset');
    }
  }

  /** Opens a picker of the practitioner's open times so a session can be moved off a day off. */
  async function startMove(booking: { id: string; clientName: string }) {
    setError(null);
    try {
      const payload = await api.get<Payload>('/v1/consult/therapist/availability');
      setMoving({
        bookingId: booking.id,
        clientName: booking.clientName,
        slots: (payload.slots ?? []).filter((s) => !s.booked),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load your open times');
    }
  }

  async function moveTo(slotId: string) {
    if (!moving) return;
    setMovingSaving(true);
    setError(null);
    try {
      await api.post(`/v1/consult/practice/sessions/${moving.bookingId}/reschedule`, { availabilityId: slotId });
      toast.success('Session moved');
      setMoving(null);
      const payload = await api.get<Payload>('/v1/consult/therapist/availability');
      apply(payload);
      await loadTimeOff();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not move the session';
      toast.error(message);
      setError(message);
    } finally {
      setMovingSaving(false);
    }
  }

  const upcoming = useMemo(() => {
    const byDate = new Map<string, SlotView[]>();
    for (const slot of slots) {
      const day = new Date(slot.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });
      byDate.set(day, [...(byDate.get(day) ?? []), slot]);
    }
    return [...byDate.entries()].slice(0, 28);
  }, [slots]);

  const tabActions = (
    <SegmentedControl
      options={['Weekly hours', 'Upcoming times', 'Time off']}
      value={tab === 'upcoming' ? 'Upcoming times' : tab === 'timeoff' ? 'Time off' : 'Weekly hours'}
      onChange={(t: string) => {
        if (t === 'Upcoming times') setTab('upcoming');
        else if (t === 'Time off') setTab('timeoff');
        else setTab('weekly');
      }}
      className="h-[40px] p-1 bg-[var(--desk-surface-muted)] rounded-[14px] inline-flex gap-1 border border-[var(--desk-border)] shrink-0"
    />
  );

  return (
    <Page
      header={
        <PageHeader
          eyebrow="PRACTICE"
          title="Availability"
          actions={
            <>
              {tabActions}
              <Button onClick={() => void save()} disabled={saving || loading}>
                <Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save availability'}
              </Button>
            </>
          }
        />
      }
    >
      {error ? <div role="alert" className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
      {loading ? <p className="text-sm text-[var(--desk-text-muted)]">Loading…</p> : (
        <div className="space-y-4">
          {tab === 'weekly' ? (
            <Card padding="p-5" className="space-y-1">
              <Eyebrow>WEEKLY HOURS</Eyebrow>
              <p className="text-[13px] text-[var(--desk-text-muted)] mb-2">Each session time gets its own format. Changes apply to open times; booked sessions and this-date-only changes stay as they are.</p>
              {DAY_KEYS.map((key, weekday) => (
                <div key={key} className="py-3 border-t border-[var(--desk-border-soft)] first:border-t-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Switch on={days[key].on} onChange={() => toggleDay(key)} label={DAYS[weekday]} />
                    <span className={`text-[14px] font-bold w-[92px] ${days[key].on ? 'text-[var(--desk-text)]' : 'text-[var(--desk-text-subtle)]'}`}>{DAYS[weekday]}</span>
                    {days[key].on ? (
                      <>
                        {days[key].windows.map((w, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5">
                            <input type="time" aria-label={`${DAYS[weekday]} from`} value={w.start} onChange={(e) => setWindow(key, i, 'start', e.target.value)} className="h-[36px] px-2 rounded-[10px] border border-[var(--desk-border)] bg-[var(--desk-surface)] text-[13px] font-bold" />
                            <span className="text-[11px] text-[var(--desk-text-subtle)]">to</span>
                            <input type="time" aria-label={`${DAYS[weekday]} until`} value={w.end} onChange={(e) => setWindow(key, i, 'end', e.target.value)} className="h-[36px] px-2 rounded-[10px] border border-[var(--desk-border)] bg-[var(--desk-surface)] text-[13px] font-bold" />
                            {days[key].windows.length > 1 ? <button type="button" onClick={() => removeWindow(key, i)} className="text-[var(--desk-text-subtle)] hover:text-[var(--desk-danger)] cursor-pointer" aria-label={`Remove ${DAYS[weekday]} hours`}>×</button> : null}
                          </span>
                        ))}
                        <button type="button" onClick={() => addWindow(key)} aria-label={`Add hours on ${DAYS[weekday]}`} className="w-[22px] h-[22px] rounded-full bg-[var(--desk-surface-muted)] text-[var(--desk-pine-600)] flex items-center justify-center cursor-pointer"><Plus className="h-3 w-3" /></button>
                        {locations.length ? (
                          <label className="ml-auto text-[11.5px] font-bold text-[var(--desk-text-body)] inline-flex items-center gap-1.5">
                            Set all {DAYS[weekday].toLowerCase()} times to
                            <select
                              className="h-[32px] rounded-[9px] border border-[var(--desk-border)] bg-[var(--desk-surface)] px-2 text-[12px] font-semibold"
                              value=""
                              onChange={(e) => {
                                if (e.target.value === 'ONLINE') setAllDay(weekday, ['ONLINE'], null);
                                else if (e.target.value === 'IN_PERSON' && locations[0]) setAllDay(weekday, ['IN_PERSON'], locations[0].id);
                                else if (e.target.value === 'BOTH' && locations[0]) setAllDay(weekday, ['ONLINE', 'IN_PERSON'], locations[0].id);
                              }}
                            >
                              <option value="">Choose…</option>
                              <option value="ONLINE">Online</option>
                              {locations.map((l) => <option key={l.id} value="IN_PERSON">In person · {l.name}</option>)}
                              {locations.map((l) => <option key={`b-${l.id}`} value="BOTH">Either · {l.name}</option>)}
                            </select>
                          </label>
                        ) : null}
                      </>
                    ) : <span className="text-[13px] text-[var(--desk-text-subtle)] font-medium">Unavailable</span>}
                  </div>
                  {days[key].on && dayTimes.some((t) => t.weekday === weekday) ? (
                    <div className="mt-2.5 flex flex-wrap gap-2 pl-[127px]">
                      {dayTimes.filter((t) => t.weekday === weekday).map((t) => (
                        <div key={t.start} className="flex items-center gap-1.5">
                          <span className="text-[12px] font-bold text-[var(--desk-text-body)]">{t.start}</span>
                          <Tile
                            id={`${weekday}|${t.start}`}
                            formats={times[`${weekday}|${t.start}`]?.formats ?? ['ONLINE']}
                            locationId={times[`${weekday}|${t.start}`]?.locationId ?? null}
                            onPick={(fs, loc) => setTime(`${weekday}|${t.start}`, fs, loc)}
                            open={openChooser === `${weekday}|${t.start}`}
                            onToggle={() => setOpenChooser(openChooser === `${weekday}|${t.start}` ? null : `${weekday}|${t.start}`)}
                            locations={locations}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </Card>
          ) : tab === 'timeoff' ? (
            <Card padding="p-5" className="space-y-4">
              <Eyebrow>TIME OFF</Eyebrow>
              <p className="text-[12.5px] text-[var(--desk-text-muted)]">Mark days you are away. Those days close to booking; existing sessions are listed so you can move them.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input type="date" className="h-[42px] rounded-[13px] border border-[var(--desk-border)] bg-[var(--desk-surface)] px-3 text-[13.5px] font-semibold" id="timeoff-start" />
                <input type="date" className="h-[42px] rounded-[13px] border border-[var(--desk-border)] bg-[var(--desk-surface)] px-3 text-[13.5px] font-semibold" id="timeoff-end" />
                <input type="text" placeholder="Optional note" className="h-[42px] rounded-[13px] border border-[var(--desk-border)] bg-[var(--desk-surface)] px-3 text-[13.5px] font-semibold" id="timeoff-note" />
              </div>
              <Button className="h-[42px]" onClick={() => {
                const start = (document.getElementById('timeoff-start') as HTMLInputElement).value;
                const end = (document.getElementById('timeoff-end') as HTMLInputElement).value || start;
                const note = (document.getElementById('timeoff-note') as HTMLInputElement).value || null;
                if (!start) { toast.error('Choose the first day'); return; }
                api.post('/v1/consult/therapist/time-off', { startsOn: start, endsOn: end, note }).then(() => {
                  toast.success('Time off added. Open times closed for those days.');
                  // Refresh
                  api.get<{ timeOff: TimeOff[]; bookings: any[] }>('/v1/consult/therapist/time-off').then((result) => {
                    const enriched = result.timeOff.map((t) => ({
                      ...t,
                      bookings: result.bookings.filter((b: any) => {
                        const slotDay = new Date(b.startsAt).toISOString().slice(0, 10);
                        return slotDay >= t.startsOn && slotDay <= t.endsOn;
                      }),
                    }));
                    setTimeOff(enriched);
                  });
                }).catch((err) => toast.error(err instanceof Error ? err.message : 'Could not add time off'));
              }}><Plus className="h-4 w-4" />Add time off</Button>

              <div className="space-y-3">
                {timeOff.map((t) => (
                  <div key={t.id} className="border border-[var(--desk-border-soft)] rounded-[14px] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[14px] font-bold text-[var(--desk-text)]">{t.startsOn} {t.startsOn !== t.endsOn ? `– ${t.endsOn}` : ''}{t.note ? ` · ${t.note}` : ''}</div>
                        <div className="text-[12px] text-[var(--desk-text-muted)]">{t.bookings.length} existing session{t.bookings.length !== 1 ? 's' : ''}</div>
                      </div>
                      <Button variant="ghost" className="text-[12px] text-[var(--desk-danger)]" onClick={() => {
                        if (!confirm('Remove this time off? Open times will be regenerated.')) return;
                        api.delete(`/v1/consult/therapist/time-off/${t.id}`).then(() => {
                          toast.success('Time off removed');
                          return loadTimeOff();
                        }).catch((err) => toast.error(err instanceof Error ? err.message : 'Could not remove'));
                      }}>Remove</Button>
                    </div>
                    {t.bookings.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {t.bookings.map((b) => (
                          <div key={b.id} className="flex items-center justify-between text-[12px] bg-[var(--desk-pending-bg)] border border-[var(--desk-pending-border)] rounded-[10px] px-3 py-2">
                            <span><span className="font-bold">{b.clientName}</span> · {b.serviceTitle} · {new Date(b.startsAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
                            <button className="text-[var(--desk-pine-600)] underline font-bold cursor-pointer" onClick={() => void startMove(b)}>Move</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {timeOff.length === 0 && (
                  <div className="text-[13px] text-[var(--desk-text-muted)]">No time off scheduled.</div>
                )}
              </div>
            </Card>
          ) : (
            <Card padding="p-5" className="space-y-2">
              <Eyebrow>UPCOMING TIMES</Eyebrow>
              <p className="text-[12.5px] text-[var(--desk-text-muted)]">Change a single date for that day only. Booked times are locked.</p>
              {upcoming.map(([day, daySlots]) => (
                <div key={day} className="flex items-start gap-3 py-2 border-t border-[var(--desk-border-soft)]">
                  <span className="w-[92px] shrink-0 text-[12.5px] font-bold text-[var(--desk-text)] pt-1">{day}</span>
                  <div className="flex flex-wrap gap-2">
                    {daySlots.map((slot) => (
                      <div key={slot.id} className="flex items-center gap-1">
                        <span className="text-[12px] font-bold text-[var(--desk-text-body)]">{formatClock(slot.startsAt)}</span>
                        <Tile
                          id={`slot-${slot.id}`}
                          formats={slot.formats}
                          locationId={slot.location?.id ?? null}
                          locked={slot.booked}
                          badge={slot.customised ? 'This date only' : undefined}
                          onPick={(fs, loc) => void changeSlot(slot, fs, loc)}
                          open={openChooser === `slot-${slot.id}`}
                          onToggle={() => setOpenChooser(openChooser === `slot-${slot.id}` ? null : `slot-${slot.id}`)}
                          locations={locations}
                        />
                        {slot.customised && !slot.booked ? (
                          <button type="button" onClick={() => void resetSlot(slot)} className="text-[11.5px] font-bold text-[var(--desk-pine-600)] underline cursor-pointer">Back to weekly</button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* Booking rules moved below tabs, full width */}
          <Card padding="p-5" className="space-y-4">
            <Eyebrow>BOOKING RULES</Eyebrow>
            <label className="block text-[11.5px] font-bold text-[var(--desk-text-body)]">Session length
              <select className="mt-1 h-[42px] w-full rounded-[13px] border border-[var(--desk-border)] bg-[var(--desk-surface)] px-3 text-[13.5px] font-semibold" value={sessionLengthMinutes} onChange={(e) => setSessionLengthMinutes(Number(e.target.value))}>
                {[30, 50, 60, 80, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </label>
            <label className="block text-[11.5px] font-bold text-[var(--desk-text-body)]">Gap between sessions
              <select className="mt-1 h-[42px] w-full rounded-[13px] border border-[var(--desk-border)] bg-[var(--desk-surface)] px-3 text-[13.5px] font-semibold" value={gapMinutes} onChange={(e) => setGapMinutes(Number(e.target.value))}>
                {[0, 10, 15, 30].map((m) => <option key={m} value={m}>{m === 0 ? 'No gap' : `${m} min`}</option>)}
              </select>
            </label>
            <label className="block text-[11.5px] font-bold text-[var(--desk-text-body)]">Minimum notice
              <select className="mt-1 h-[42px] w-full rounded-[13px] border border-[var(--desk-border)] bg-[var(--desk-surface)] px-3 text-[13.5px] font-semibold" value={cancellationHours} onChange={(e) => setCancellationHours(Number(e.target.value))}>
                {[12, 24, 48].map((h) => <option key={h} value={h}>{h} hours</option>)}
              </select>
            </label>
            <VideoRoomOpensSetting />
            <div className="p-3.5 rounded-[14px] bg-[var(--desk-pine-100)] text-[var(--desk-pine-600)] text-xs font-medium flex items-start gap-2.5 leading-relaxed">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Saving regenerates the next 28 days of open times from this week.</span>
            </div>
          </Card>
        </div>
      )}

      {moving ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="Move session">
          <Card padding="p-5" className="w-full max-w-[480px] max-h-[80vh] overflow-y-auto space-y-3">
            <div>
              <Eyebrow>MOVE SESSION</Eyebrow>
              <p className="mt-1 text-[13px] text-[var(--desk-text-body)]">
                Choose a new time for <span className="font-bold text-[var(--desk-text)]">{moving.clientName}</span>. Their current time is not cancelled.
              </p>
            </div>
            {moving.slots.length === 0 ? (
              <p className="text-[13px] text-[var(--desk-text-muted)]">No open times to move to. Add hours in Weekly hours first.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {moving.slots.slice(0, 24).map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={movingSaving}
                    onClick={() => void moveTo(slot.id)}
                    className="h-[40px] rounded-[12px] border border-[var(--desk-border)] bg-white px-2 text-[12.5px] font-bold text-[var(--desk-text)] hover:border-[var(--desk-pine-600)] disabled:opacity-50 cursor-pointer"
                  >
                    {new Date(slot.startsAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setMoving(null)} disabled={movingSaving}>Close</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </Page>
  );
}
