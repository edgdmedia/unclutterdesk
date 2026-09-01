import React, { useEffect, useState } from 'react';
import { Save, Plus, Info } from 'lucide-react';
import { Eyebrow } from '@unclutterdesk/ui';
import { api } from '../utils/apiClient';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type Window = { start: string; end: string };
type DayState = { on: boolean; windows: Window[] };
type AvailabilityPayload = { cancellationHours: number; slots: Array<{ id: string; startsAt: string; endsAt: string; isActive: boolean }> };

const DAYS: Array<{ key: DayKey; label: string; index: number }> = [
  { key: 'mon', label: 'Monday', index: 0 },
  { key: 'tue', label: 'Tuesday', index: 1 },
  { key: 'wed', label: 'Wednesday', index: 2 },
  { key: 'thu', label: 'Thursday', index: 3 },
  { key: 'fri', label: 'Friday', index: 4 },
  { key: 'sat', label: 'Saturday', index: 5 },
  { key: 'sun', label: 'Sunday', index: 6 },
];

const EMPTY_DAYS: Record<DayKey, DayState> = {
  mon: { on: false, windows: [] },
  tue: { on: false, windows: [] },
  wed: { on: false, windows: [] },
  thu: { on: false, windows: [] },
  fri: { on: false, windows: [] },
  sat: { on: false, windows: [] },
  sun: { on: false, windows: [] },
};

function toTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function deriveDays(slots: AvailabilityPayload['slots']): Record<DayKey, DayState> {
  const next = structuredClone(EMPTY_DAYS);
  const grouped = new Map<DayKey, Array<{ start: string; end: string }>>();

  for (const slot of slots) {
    const start = new Date(slot.startsAt);
    const end = new Date(slot.endsAt);
    const weekday = DAYS[(start.getDay() + 6) % 7].key;
    const values = grouped.get(weekday) || [];
    values.push({ start: toTime(start), end: toTime(end) });
    grouped.set(weekday, values);
  }

  for (const day of DAYS) {
    const values = grouped.get(day.key) || [];
    if (values.length === 0) continue;
    const sorted = values.sort((a, b) => a.start.localeCompare(b.start));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    next[day.key] = { on: true, windows: [{ start: first.start, end: last.end }] };
  }

  return next;
}

function Switch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onChange} className="w-[40px] h-[22px] rounded-full relative transition-colors cursor-pointer shrink-0" style={{ backgroundColor: on ? '#15803D' : '#E2E8F0' }}>
      <span className="absolute top-[3px] h-[16px] w-[16px] rounded-full bg-white shadow-[0_2px_5px_rgba(15,23,42,0.2)] transition-[left] duration-150" style={{ left: on ? '21px' : '3px' }} />
    </button>
  );
}

export function AvailabilitySettingsPage() {
  const [days, setDays] = useState<Record<DayKey, DayState>>(EMPTY_DAYS);
  const [sessionLengthMinutes, setSessionLengthMinutes] = useState(50);
  const [gapMinutes, setGapMinutes] = useState(10);
  const [cancellationHours, setCancellationHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadAvailability() {
      setLoading(true);
      setError(null);
      try {
        const payload = await api.get<AvailabilityPayload>('/v1/consult/therapist/availability');
        if (cancelled) return;
        setDays(deriveDays(payload.slots));
        setCancellationHours(payload.cancellationHours);
        if (payload.slots[0]) {
          const start = new Date(payload.slots[0].startsAt);
          const end = new Date(payload.slots[0].endsAt);
          setSessionLengthMinutes(Math.round((end.getTime() - start.getTime()) / 60_000));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load availability');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadAvailability();
    return () => { cancelled = true; };
  }, []);

  const toggleDay = (key: DayKey) => setDays((prev) => ({ ...prev, [key]: { ...prev[key], on: !prev[key].on, windows: prev[key].windows.length ? prev[key].windows : [{ start: '09:00', end: '17:00' }] } }));
  const addWindow = (key: DayKey) => setDays((prev) => ({ ...prev, [key]: { ...prev[key], windows: [...prev[key].windows, { start: '09:00', end: '12:00' }] } }));
  const setWindow = (key: DayKey, index: number, field: 'start' | 'end', value: string) => setDays((prev) => ({ ...prev, [key]: { ...prev[key], windows: prev[key].windows.map((window, current) => current === index ? { ...window, [field]: value } : window) } }));
  const removeWindow = (key: DayKey, index: number) => setDays((prev) => ({ ...prev, [key]: { ...prev[key], windows: prev[key].windows.filter((_, current) => current !== index) } }));

  const workingDays = DAYS.filter((day) => days[day.key].on).length;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.patch('/v1/consult/therapist/availability', {
        days: DAYS.map((day) => ({ day: day.index, enabled: days[day.key].on, windows: days[day.key].windows })),
        sessionLengthMinutes,
        gapMinutes,
        cancellationHours,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save availability');
    } finally {
      setSaving(false);
    }
  }

  const searchParams = new URLSearchParams(window.location.search);
  const isGoogleConnected = searchParams.get('google_connected') === 'true';

  async function handleGoogleConnect() {
    try {
      const { url } = await api.get<{ url: string }>('/v1/calendar/google/auth');
      window.location.href = url;
    } catch (err) {
      setError('Unable to initiate Google Calendar connection');
    }
  }

  return (
    <div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">
      <header className="h-[88px] bg-white border-b border-[#E2E8F0] px-[26px] flex items-center gap-5 shrink-0">
        <div>
          <Eyebrow>SETTINGS</Eyebrow>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Availability & blocked time</h1>
          <p className="text-xs text-[#64748B] font-medium">{workingDays} working day{workingDays === 1 ? '' : 's'} generated into real future booking slots</p>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          {isGoogleConnected ? (
            <div className="h-[44px] px-5 rounded-[14px] font-bold text-sm flex items-center gap-2 bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
              <div className="w-2 h-2 rounded-full bg-[#10B981]" />
              Google Calendar Connected
            </div>
          ) : (
            <button onClick={handleGoogleConnect} className="h-[44px] px-5 rounded-[14px] font-bold text-sm flex items-center gap-2 bg-white text-[#0F172A] border border-[#E2E8F0] shadow-sm hover:bg-slate-50 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Connect Google Calendar
            </button>
          )}

          <button onClick={() => void handleSave()} className="os-brand-btn h-[44px] px-5 rounded-[14px] font-bold text-sm flex items-center gap-2 text-white cursor-pointer disabled:opacity-60" style={{ backgroundColor: '#0F3A53' }} disabled={saving || loading}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save availability'}
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[24px_26px_32px] grid grid-cols-[minmax(0,1fr)_340px] gap-[20px] items-start">
        <div className="flex flex-col gap-5">
          {error ? <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[22px_24px]">
            <Eyebrow className="mb-1">WEEKLY HOURS</Eyebrow>
            <h3 className="text-[17px] font-bold tracking-[-0.01em] text-[#0F172A]">When clients can book you</h3>
            {loading ? <div className="mt-6 text-sm font-medium text-[#64748B]">Loading availability...</div> : (
              <div className="mt-4 flex flex-col">
                {DAYS.map((day, dayIndex) => (
                  <div key={day.key} className={`flex items-center gap-4 py-[14px] px-[16px] ${dayIndex > 0 ? 'border-t border-[#F1F5F9]' : ''}`}>
                    <div className="w-[150px] flex items-center gap-3 shrink-0">
                      <Switch on={days[day.key].on} onChange={() => toggleDay(day.key)} />
                      <span className={`text-[14px] font-bold ${days[day.key].on ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>{day.label}</span>
                    </div>
                    {days[day.key].on ? (
                      <div className="flex-1 flex items-center gap-2.5 flex-wrap">
                        {days[day.key].windows.map((window, index) => (
                          <div key={`${day.key}_${index}`} className="flex items-center gap-2.5">
                            <input type="time" value={window.start} onChange={(event) => setWindow(day.key, index, 'start', event.target.value)} className="w-[110px] h-[42px] px-3 rounded-[13px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13.5px] font-bold text-[#0F172A] outline-none" />
                            <span className="text-[12px] text-[#94A3B8] font-medium">to</span>
                            <input type="time" value={window.end} onChange={(event) => setWindow(day.key, index, 'end', event.target.value)} className="w-[110px] h-[42px] px-3 rounded-[13px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13.5px] font-bold text-[#0F172A] outline-none" />
                            {days[day.key].windows.length > 1 ? <button onClick={() => removeWindow(day.key, index)} className="text-[#94A3B8] hover:text-[#DC2626] cursor-pointer">×</button> : null}
                          </div>
                        ))}
                        <button onClick={() => addWindow(day.key)} className="w-[22px] h-[22px] rounded-full bg-[#F1F5F9] text-[#0F3A53] flex items-center justify-center hover:bg-[#E2E8F0] cursor-pointer shrink-0"><Plus className="h-3 w-3" /></button>
                      </div>
                    ) : <span className="text-[13px] font-medium text-[#94A3B8]">Unavailable</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[22px_24px]">
            <Eyebrow className="mb-1">BOOKING RULES</Eyebrow>
            <div className="space-y-4 mt-4">
              <label className="block text-[11.5px] font-bold text-[#475569]">Session length
                <select className="mt-1 h-[42px] w-full rounded-[13px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[13.5px] font-semibold" value={sessionLengthMinutes} onChange={(event) => setSessionLengthMinutes(Number(event.target.value))}>
                  <option value={50}>50 min</option>
                  <option value={60}>60 min</option>
                  <option value={80}>80 min</option>
                </select>
              </label>
              <label className="block text-[11.5px] font-bold text-[#475569]">Gap between sessions
                <select className="mt-1 h-[42px] w-full rounded-[13px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[13.5px] font-semibold" value={gapMinutes} onChange={(event) => setGapMinutes(Number(event.target.value))}>
                  <option value={0}>No gap</option>
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                </select>
              </label>
              <label className="block text-[11.5px] font-bold text-[#475569]">Minimum notice
                <select className="mt-1 h-[42px] w-full rounded-[13px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[13.5px] font-semibold" value={cancellationHours} onChange={(event) => setCancellationHours(Number(event.target.value))}>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                </select>
              </label>
            </div>
            <div className="mt-5 p-3.5 rounded-[14px] bg-[#EFF6FB] text-[#0F3A53] text-xs font-medium flex items-start gap-2.5 leading-relaxed">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Saving regenerates the next 28 days of bookable slots from these weekly windows.</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
