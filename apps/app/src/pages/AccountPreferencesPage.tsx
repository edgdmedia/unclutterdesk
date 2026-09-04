import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Info, Loader2, Monitor, Save } from 'lucide-react';
import { Eyebrow } from '@unclutterdesk/ui';
import { api } from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';

/**
 * Account and preferences.
 *
 * Almost none of this page did anything. "Save preferences" had no handler and
 * no column to write to; the email carried a green "Verified" chip whatever the
 * account's real state; the password row claimed "last changed 3 months ago";
 * a two-factor toggle said it was "required for clinical records" with nothing
 * behind it; the preview quoted invented monthly revenue; and an "Active
 * sessions" panel listed a MacBook Pro and an iPhone 14 in Lagos to every user
 * on earth. A page about account security is the worst place to invent things:
 * someone checking for unauthorised access was reading fiction.
 *
 * The session list and the password date are now real: refresh tokens are
 * recorded per device and can be revoked, so this page reports what the server
 * knows and nothing else. Everything here is backed by an endpoint; what still
 * is not has been removed rather than left looking real — see the note at the
 * end of the file.
 */
type DateFmt = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'D MMM YYYY';
type TimeFmt = '24-hour' | '12-hour';
type WeekStart = 'Monday' | 'Sunday';
type NumFmt = '1,234.56' | '1.234,56';

interface Preferences {
  email: string;
  emailVerified: boolean;
  locale: string;
  timezone: string;
  dateFormat: DateFmt;
  timeFormat: TimeFmt;
  weekStartsOn: WeekStart;
  numberFormat: NumFmt;
  /** Null for a password set before this was recorded. */
  passwordChangedAt: string | null;
}

interface ActiveSession {
  id: string;
  device: string;
  ipAddress: string | null;
  lastUsedAt: string;
  startedAt: string;
  current: boolean;
}

const LOCALES = [
  { value: 'en-NG', label: 'English (Nigeria)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'fr-FR', label: 'Français' },
];

const TIMEZONES = [
  { value: 'Africa/Lagos', label: 'GMT+1 · Lagos' },
  { value: 'Africa/Accra', label: 'GMT+0 · Accra' },
  { value: 'Europe/London', label: 'GMT+0 · London' },
  { value: 'Africa/Nairobi', label: 'GMT+3 · Nairobi' },
];

/**
 * The preview shows a real date — the one being formatted is a fixed sample so
 * the difference between formats is legible, but the formatting is the same
 * code path the rest of the app uses.
 */
const SAMPLE = new Date('2026-08-14T10:00:00Z');

function formatSampleDate(fmt: DateFmt, locale: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(SAMPLE)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});

  switch (fmt) {
    case 'DD/MM/YYYY':
      return `${parts.day}/${parts.month}/${parts.year}`;
    case 'MM/DD/YYYY':
      return `${parts.month}/${parts.day}/${parts.year}`;
    case 'YYYY-MM-DD':
      return `${parts.year}-${parts.month}-${parts.day}`;
    default:
      return new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(SAMPLE);
  }
}

function formatSampleTime(fmt: TimeFmt, locale: string, timezone: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: fmt === '12-hour',
  }).format(SAMPLE);
}

function formatSampleNumber(fmt: NumFmt): string {
  return fmt === '1,234.56' ? '1,234.56' : '1.234,56';
}

/**
 * "3 days ago" for a date the server supplied.
 *
 * The old page hard-coded "last changed 3 months ago". This says how long ago
 * something the server recorded actually happened, and nothing at all when
 * there is no date to report.
 */
function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return 'Unknown';
  if (seconds < 60) return 'Just now';

  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
    [2592000, 'month'],
    [31536000, 'year'],
  ];
  let chosen: [number, Intl.RelativeTimeFormatUnit] = units[0];
  for (const unit of units) {
    if (seconds >= unit[0]) chosen = unit;
  }
  const fmt = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  return fmt.format(-Math.floor(seconds / chosen[0]), chosen[1]);
}

const selectCls =
  'h-[46px] w-full px-[14px] rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-semibold text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8] cursor-pointer';

const inputCls =
  'h-[46px] w-full px-[14px] rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-medium text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8]';

function ChipGroup<T extends string>({
  value,
  options,
  onSelect,
  label,
}: {
  value: T;
  options: T[];
  onSelect: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onSelect(o)}
          className={`h-[42px] px-4 rounded-[13px] text-[13px] font-bold transition-all cursor-pointer ${
            value === o
              ? 'bg-[#0F3A53] text-white shadow-[0_6px_16px_rgba(15,58,83,0.22)]'
              : 'bg-white text-[#334155] border border-[#E2E8F0] hover:bg-[#F1F5F9]'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className="relative rounded-full transition-colors cursor-pointer shrink-0"
      style={{ width: 48, height: 28, backgroundColor: on ? '#15803D' : '#CBD5E1' }}
    >
      <span
        className="absolute top-1/2 -translate-y-1/2 rounded-full bg-white transition-transform duration-[180ms]"
        style={{ width: 20, height: 20, left: 4, transform: `translate(${on ? 20 : 0}px, -50%)` }}
      />
    </button>
  );
}

/** The channels the notification API actually delivers on. */
const CHANNELS = [
  { key: 'email' as const, name: 'Email', desc: 'Bookings, payments, forms' },
  { key: 'push' as const, name: 'Push', desc: 'Browser and mobile app' },
  { key: 'sms' as const, name: 'SMS', desc: 'Charged per message' },
];

interface ChannelPref {
  module: string;
  category: string | null;
  channel: string;
  enabled: boolean;
}

export function AccountPreferencesPage() {
  const { profile } = useAuth();

  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Channel toggles save on click; they are separate rows in the API rather
  // than part of the preferences record.
  const [channels, setChannels] = useState<Record<string, boolean>>({});
  const [channelError, setChannelError] = useState<string | null>(null);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwState, setPwState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [pwError, setPwError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  // The id being signed out, so only that row shows as busy.
  const [endingSession, setEndingSession] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Preferences>('/v1/auth/preferences');
      setPrefs(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load your preferences');
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await api.get<ActiveSession[]>('/v1/auth/sessions'));
      setSessionError(null);
    } catch (err) {
      // No list at all, rather than an empty one: "no other devices" and "we
      // could not check" are different answers to the question being asked.
      setSessions(null);
      setSessionError(
        err instanceof Error ? err.message : 'Your signed-in devices could not be loaded',
      );
    }
  }, []);

  useEffect(() => {
    void load();
    void loadSessions();
  }, [load, loadSessions]);

  useEffect(() => {
    api
      .get<ChannelPref[]>('/v1/notifications/preferences')
      .then((rows) => {
        // Absent means on: a channel is only off once someone turns it off.
        const state: Record<string, boolean> = { email: true, push: true, sms: false };
        for (const row of rows) {
          if (row.module === 'all' && row.channel in state) state[row.channel] = row.enabled;
        }
        setChannels(state);
      })
      .catch(() => setChannelError('Notification channels could not be loaded'));
  }, []);

  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((current) => (current ? { ...current, [key]: value } : current));
    setSaved(false);
  };

  async function savePreferences() {
    if (!prefs || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.put<Preferences>('/v1/auth/preferences', {
        locale: prefs.locale,
        timezone: prefs.timezone,
        dateFormat: prefs.dateFormat,
        timeFormat: prefs.timeFormat,
        weekStartsOn: prefs.weekStartsOn,
        numberFormat: prefs.numberFormat,
      });
      // Show what was stored, not what was sent.
      setPrefs(updated);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your preferences');
    } finally {
      setSaving(false);
    }
  }

  async function toggleChannel(channel: string) {
    const next = !channels[channel];
    setChannels((c) => ({ ...c, [channel]: next }));
    setChannelError(null);
    try {
      await api.put('/v1/notifications/preferences', { module: 'all', channel, enabled: next });
    } catch (err) {
      // Put it back: a toggle that springs back is honest about not having saved.
      setChannels((c) => ({ ...c, [channel]: !next }));
      setChannelError(err instanceof Error ? err.message : 'Could not save that channel');
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwState === 'saving') return;

    if (pw.next.length < 8) {
      setPwError('Choose a new password of at least 8 characters.');
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwError('The two new passwords do not match.');
      return;
    }

    setPwState('saving');
    setPwError(null);
    try {
      await api.post('/v1/auth/change-password', {
        currentPassword: pw.current,
        newPassword: pw.next,
      });
      setPw({ current: '', next: '', confirm: '' });
      setPwState('done');
      // The change ends every other session and stamps the date, so both the
      // list and "last changed" are now stale.
      await Promise.all([load(), loadSessions()]);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Could not change your password');
      setPwState('idle');
    }
  }

  async function endSession(id: string) {
    if (endingSession) return;
    setEndingSession(id);
    setSessionError(null);
    try {
      const result = await api.delete<{ endedCurrentSession: boolean }>(
        `/v1/auth/sessions/${id}`,
      );
      // Signing out of the device you are on is allowed; the server has
      // already cleared the cookies, so the only honest thing left is to
      // reload into the signed-out state.
      if (result?.endedCurrentSession) {
        window.location.assign('/login');
        return;
      }
      await loadSessions();
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Could not sign out that device');
    } finally {
      setEndingSession(null);
    }
  }

  async function endOtherSessions() {
    if (endingSession) return;
    setEndingSession('others');
    setSessionError(null);
    try {
      await api.post('/v1/auth/sessions/revoke-others', {});
      await loadSessions();
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Could not sign out your other devices');
    } finally {
      setEndingSession(null);
    }
  }

  const preview = useMemo(() => {
    if (!prefs) return null;
    return {
      date: formatSampleDate(prefs.dateFormat, prefs.locale, prefs.timezone),
      time: formatSampleTime(prefs.timeFormat, prefs.locale, prefs.timezone),
      number: formatSampleNumber(prefs.numberFormat),
    };
  }, [prefs]);

  return (
    <div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">
      <header className="h-[88px] bg-white border-b border-[#E2E8F0] px-[26px] flex items-center gap-5 shrink-0">
        <div>
          <Eyebrow>ACCOUNT</Eyebrow>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">
            Account &amp; preferences
          </h1>
          <p className="text-xs text-[#64748B] font-medium">
            Sign-in, and how dates and numbers are shown to you
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {saved ? (
            <span
              role="status"
              className="text-[12px] font-bold text-[#15803D] flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" strokeWidth={2.6} />
              Saved
            </span>
          ) : (
            <span className="text-[11.5px] text-[#94A3B8] font-medium">
              Changes apply to your account only
            </span>
          )}
          <button
            type="button"
            onClick={savePreferences}
            disabled={!prefs || saving}
            className="os-brand-btn h-[44px] px-5 rounded-[14px] font-bold text-sm flex items-center gap-2 text-white cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#0F3A53' }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save preferences'}
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[24px_26px_32px] grid grid-cols-[minmax(0,1fr)_352px] gap-[20px] items-start">
        <div className="flex flex-col gap-5">
          {loadError ? (
            <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {loadError}
            </div>
          ) : null}
          {saveError ? (
            <div
              role="alert"
              className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
            >
              {saveError}
            </div>
          ) : null}

          {/* Sign-in */}
          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
            <Eyebrow className="mb-1">SIGN-IN</Eyebrow>
            <h3 className="text-[15px] font-bold tracking-[-0.01em] text-[#0F172A] mb-5">
              How you access your account
            </h3>
            <div className="flex flex-col gap-[10px]">
              <div className="flex items-center gap-4 px-4 py-[14px] rounded-[20px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">
                    Email
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[13.5px] font-semibold text-[#0F172A]">
                      {prefs?.email ?? profile?.email ?? '—'}
                    </span>
                    {/* Was a green "Verified" chip regardless of the real state. */}
                    {prefs ? (
                      prefs.emailVerified ? (
                        <span className="h-[18px] px-2 rounded-full bg-[#ECFDF5] text-[#059669] text-[9px] font-black tracking-[0.06em] uppercase flex items-center">
                          Verified
                        </span>
                      ) : (
                        <span className="h-[18px] px-2 rounded-full bg-[#FFFBEB] text-[#B45309] text-[9px] font-black tracking-[0.06em] uppercase flex items-center">
                          Unverified
                        </span>
                      )
                    ) : null}
                  </div>
                </div>
              </div>

              <form
                onSubmit={changePassword}
                className="px-4 py-[16px] rounded-[20px] bg-[#F8FAFC] border border-[#E2E8F0]"
              >
                <div className="flex items-baseline gap-2 flex-wrap">
                  <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">
                    Password
                  </div>
                  {/*
                    Was the literal string "last changed 3 months ago" for every
                    account. It now says what the server recorded, and says
                    nothing was recorded when nothing was.
                  */}
                  <span className="text-[11.5px] font-medium text-[#64748B]">
                    {prefs?.passwordChangedAt
                      ? `Last changed ${timeAgo(prefs.passwordChangedAt)}`
                      : 'Last change not recorded'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <input
                    type="password"
                    aria-label="Current password"
                    placeholder="Current password"
                    autoComplete="current-password"
                    value={pw.current}
                    onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                    className={inputCls}
                  />
                  <input
                    type="password"
                    aria-label="New password"
                    placeholder="New password"
                    autoComplete="new-password"
                    value={pw.next}
                    onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                    className={inputCls}
                  />
                  <input
                    type="password"
                    aria-label="Confirm new password"
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    value={pw.confirm}
                    onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                {pwError ? (
                  <div
                    role="alert"
                    className="mt-2.5 flex items-start gap-2 text-[12px] font-medium text-[#B91C1C]"
                  >
                    <AlertCircle className="h-4 w-4 flex-none mt-[1px]" />
                    <span>{pwError}</span>
                  </div>
                ) : null}
                {pwState === 'done' ? (
                  <p role="status" className="mt-2.5 text-[12px] font-bold text-[#15803D]">
                    Your password has been changed. Your other devices have been signed out.
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={!pw.current || !pw.next || pwState === 'saving'}
                  className="mt-3 h-[38px] px-4 rounded-[12px] bg-white border border-[#E2E8F0] text-[12.5px] font-bold text-[#0F3A53] hover:bg-[#F1F5F9] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pwState === 'saving' ? 'Changing…' : 'Change password'}
                </button>
              </form>
            </div>
          </div>

          {/* Region & language */}
          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
            <Eyebrow className="mb-1">REGION &amp; LANGUAGE</Eyebrow>
            <h3 className="text-[15px] font-bold tracking-[-0.01em] text-[#0F172A] mb-5">
              Where you work
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="pref-locale"
                  className="block text-[11.5px] font-bold text-[#475569] mb-1.5"
                >
                  Language
                </label>
                <select
                  id="pref-locale"
                  className={selectCls}
                  value={prefs?.locale ?? ''}
                  disabled={!prefs}
                  onChange={(e) => set('locale', e.target.value)}
                >
                  {LOCALES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="pref-timezone"
                  className="block text-[11.5px] font-bold text-[#475569] mb-1.5"
                >
                  Time zone
                </label>
                <select
                  id="pref-timezone"
                  className={selectCls}
                  value={prefs?.timezone ?? ''}
                  disabled={!prefs}
                  onChange={(e) => set('timezone', e.target.value)}
                >
                  {TIMEZONES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 rounded-[14px] bg-[#F1F5F9] p-[12px_14px] flex items-start gap-2.5">
              <Info className="h-4 w-4 text-[#64748B] mt-0.5 shrink-0" />
              <p className="text-[12px] text-[#64748B] font-medium leading-snug">
                Money is always shown in the practice&apos;s own currency, for both you and your
                clients — there is no per-person conversion.
              </p>
            </div>
          </div>

          {/* Date, time & numbers */}
          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
            <Eyebrow className="mb-1">DATE, TIME &amp; NUMBERS</Eyebrow>
            <h3 className="text-[15px] font-bold tracking-[-0.01em] text-[#0F172A] mb-5">
              How things are written
            </h3>

            <div className="space-y-5">
              <div>
                <span className="block text-[11.5px] font-bold text-[#475569] mb-2">Date format</span>
                <ChipGroup
                  label="Date format"
                  value={prefs?.dateFormat ?? 'DD/MM/YYYY'}
                  options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'D MMM YYYY']}
                  onSelect={(v) => set('dateFormat', v)}
                />
              </div>
              <div>
                <span className="block text-[11.5px] font-bold text-[#475569] mb-2">Time format</span>
                <ChipGroup
                  label="Time format"
                  value={prefs?.timeFormat ?? '24-hour'}
                  options={['24-hour', '12-hour']}
                  onSelect={(v) => set('timeFormat', v)}
                />
              </div>
              <div>
                <span className="block text-[11.5px] font-bold text-[#475569] mb-2">
                  Week starts on
                </span>
                <ChipGroup
                  label="Week starts on"
                  value={prefs?.weekStartsOn ?? 'Monday'}
                  options={['Monday', 'Sunday']}
                  onSelect={(v) => set('weekStartsOn', v)}
                />
              </div>
              <div>
                <span className="block text-[11.5px] font-bold text-[#475569] mb-2">
                  Number format
                </span>
                <ChipGroup
                  label="Number format"
                  value={prefs?.numberFormat ?? '1,234.56'}
                  options={['1,234.56', '1.234,56']}
                  onSelect={(v) => set('numberFormat', v)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <div
            className="rounded-[24px] p-[24px_26px] shadow-[0_14px_40px_rgba(15,58,83,0.22)]"
            style={{ background: 'linear-gradient(135deg,#0F3A53,#1B5375)' }}
          >
            <span className="text-[9px] font-black tracking-[0.22em] uppercase text-[#E3B341] block">
              PREVIEW
            </span>
            <div className="mt-3 flex flex-col">
              {/*
                The third row used to be "THIS MONTH'S REVENUE" with an invented
                figure per currency. A preview of formatting has no business
                quoting money the practice did not earn.
              */}
              {[
                { label: 'A DATE', value: preview?.date ?? '—' },
                { label: 'A TIME', value: preview?.time ?? '—' },
                { label: 'A NUMBER', value: preview?.number ?? '—' },
                { label: 'WEEK VIEW STARTS', value: prefs?.weekStartsOn ?? '—' },
              ].map((row, i) => (
                <React.Fragment key={row.label}>
                  {i > 0 && <div className="h-px bg-white/10" />}
                  <div className="py-[13px]">
                    <div className="text-[11px] font-bold text-[#94A3B8] tracking-[0.06em]">
                      {row.label}
                    </div>
                    <div className="mt-0.5 text-[19px] font-bold text-white">{row.value}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[22px_24px] shadow-[0_8px_26px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-bold text-[#0F172A]">Active sessions</span>
              {sessions && sessions.length > 1 ? (
                <button
                  type="button"
                  onClick={endOtherSessions}
                  disabled={endingSession !== null}
                  className="text-[11.5px] font-bold text-[#0F3A53] hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {endingSession === 'others' ? 'Signing out…' : 'Sign out other devices'}
                </button>
              ) : null}
            </div>
            <p className="mt-1 text-[11.5px] text-[#94A3B8] font-medium leading-snug">
              Devices signed in to this account. Sign out anything you do not recognise.
            </p>

            {sessionError ? (
              <p role="alert" className="mt-3 text-[11.5px] font-medium text-[#B91C1C]">
                {sessionError}
              </p>
            ) : null}

            {sessions === null && !sessionError ? (
              <p className="mt-3 text-[11.5px] text-[#94A3B8] font-medium">Loading…</p>
            ) : null}

            {sessions ? (
              <ul className="mt-3 flex flex-col gap-2.5">
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-[16px] bg-[#F8FAFC] border border-[#E2E8F0]"
                  >
                    <Monitor className="h-4 w-4 text-[#64748B] mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[12.5px] font-bold text-[#0F172A]">
                          {session.device}
                        </span>
                        {session.current ? (
                          <span className="h-[16px] px-1.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[9px] font-black tracking-[0.06em] uppercase flex items-center">
                            This device
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-[#94A3B8] font-medium">
                        {/*
                          An address the server saw, not a city name: the old
                          panel said "Lagos, Nigeria" for everyone, which is a
                          guess dressed up as a fact.
                        */}
                        {session.ipAddress ? `${session.ipAddress} · ` : ''}
                        Last used {timeAgo(session.lastUsedAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => endSession(session.id)}
                      disabled={endingSession !== null}
                      aria-label={`Sign out ${session.device}`}
                      className="text-[11.5px] font-bold text-[#B91C1C] hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      {endingSession === session.id ? '…' : 'Sign out'}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[22px_24px] shadow-[0_8px_26px_rgba(15,23,42,0.05)]">
            <span className="text-[15px] font-bold text-[#0F172A]">Notification channels</span>
            <div className="mt-3 flex flex-col gap-3.5">
              {CHANNELS.map((c) => (
                <div key={c.key} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-[13px] font-bold text-[#0F172A]">{c.name}</div>
                    <div className="text-[11.5px] text-[#94A3B8] font-medium">{c.desc}</div>
                  </div>
                  <Toggle
                    label={`${c.name} notifications`}
                    on={channels[c.key] ?? false}
                    onChange={() => toggleChannel(c.key)}
                  />
                </div>
              ))}
            </div>
            {channelError ? (
              <p role="alert" className="mt-3 text-[11.5px] font-medium text-[#B91C1C]">
                {channelError}
              </p>
            ) : (
              <p className="mt-3 pt-3 border-t border-[#F1F5F9] text-[11px] text-[#94A3B8] font-medium">
                Saved as you switch them. Per-event controls live in Notifications settings.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/*
 * Deliberately absent, because nothing implements them yet. Each would be a
 * claim the product cannot keep:
 *
 * - Two-factor authentication. The toggle said "required for clinical records",
 *   which was false in a way a clinician could rely on.
 * - Export my data. A real subject-access export is its own piece of work.
 * - Change email. Needs re-verification of the new address before the switch.
 * - Deactivate account. Closing a whole practice is POST /v1/privacy/practice/close
 *   and belongs with the practice settings, not on a personal preferences page;
 *   an individual staff account is deactivated by an owner from Team settings.
 */
