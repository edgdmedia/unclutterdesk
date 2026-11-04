import { useEffect, useId, useState } from 'react';
import { Button, Input, useToast } from '@unclutterdesk/ui';
import { profileApi, type BookingInfo, type BookingMode } from './profileApi';
import { useStartBookingSetup } from './useStartBookingSetup';

const CHOICES: { mode: BookingMode; title: string; body: string; recommended?: boolean }[] = [
  {
    mode: 'DESK',
    title: 'Clients book through Therapysts',
    body: 'Times and fees come from your dashboard. Clients pay in naira when they book, and get confirmations and reminders for you.',
    recommended: true,
  },
  { mode: 'EXTERNAL', title: 'Use my own booking link', body: 'Your "Book a session" button opens a booking page you already use elsewhere.' },
  { mode: 'NONE', title: 'Contact only', body: 'No booking button. Clients reach you by the email and links on your profile.' },
];

const MISSING_TEXT: Record<'service' | 'availability', string> = {
  service: 'a service with its fee',
  availability: 'the times you are open',
};

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong');

/**
 * How clients book from the profile (§6.9). Saved on its own (PUT me/booking),
 * separate from the profile text. Booking through Therapysts comes first and
 * is recommended; it can only be chosen once the practice can take bookings,
 * and until then offers the set-up instead.
 */
export function BookingChoice() {
  const toast = useToast();
  const name = useId();
  const { start, busy: starting } = useStartBookingSetup();
  const [info, setInfo] = useState<BookingInfo | null>(null);
  const [mode, setMode] = useState<BookingMode>('DESK');
  const [link, setLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    profileApi
      .booking()
      .then((b) => {
        if (!live) return;
        setInfo(b);
        setMode(b.mode);
        setLink(b.externalBookingUrl ?? '');
      })
      .catch((err) => live && setLoadError(errorText(err)));
    return () => {
      live = false;
    };
  }, []);

  if (loadError) return <p className="text-[13px] text-[var(--desk-danger)]">Could not load your booking choice: {loadError}</p>;
  if (!info) return <p className="text-[13px] text-[var(--desk-text-muted)]">Loading your booking choice…</p>;

  const deskBlocked = mode === 'DESK' && !info.deskReady;
  const unchanged = mode === info.mode && (mode !== 'EXTERNAL' || link.trim() === (info.externalBookingUrl ?? ''));

  async function save() {
    setSaving(true);
    try {
      const next = await profileApi.setBooking(mode === 'EXTERNAL' ? { mode, externalBookingUrl: link.trim() } : { mode });
      setInfo(next);
      toast.success('Booking choice saved');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <fieldset className="flex flex-col gap-3 min-w-0">
      <legend className="text-[14px] font-bold text-[var(--desk-text)] mb-2">How clients book you</legend>
      {CHOICES.map((c) => {
        const checked = mode === c.mode;
        return (
          <label
            key={c.mode}
            className={`flex gap-3 rounded-[16px] border p-4 cursor-pointer transition-colors ${
              checked ? 'border-[var(--desk-pine-600)] bg-[var(--desk-pine-050)]' : 'border-[var(--desk-border)] bg-white hover:border-[var(--desk-pine-200)]'
            }`}
          >
            <input type="radio" name={name} value={c.mode} checked={checked} onChange={() => setMode(c.mode)} className="mt-1 h-4 w-4 accent-[var(--desk-pine-600)] shrink-0" />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[14.5px] font-bold text-[var(--desk-text)]">{c.title}</span>
                {c.recommended && (
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--desk-pine-600)] bg-[var(--desk-pine-100)] rounded-full px-2 py-0.5">Recommended</span>
                )}
                {info.mode === c.mode && <span className="text-[12px] text-[var(--desk-text-muted)]">· current</span>}
              </span>
              <span className="block mt-0.5 text-[13px] leading-relaxed text-[var(--desk-text-body)]">{c.body}</span>
            </span>
          </label>
        );
      })}

      {mode === 'EXTERNAL' && (
        <Input
          label="Your booking link"
          optionalLabel="(https:// link)"
          type="url"
          value={link}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLink(e.target.value)}
        />
      )}

      {deskBlocked && (
        <div role="status" className="rounded-[16px] bg-[var(--desk-pending-bg)] border border-[var(--desk-pending-border)] p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-[13px] leading-relaxed text-[var(--desk-pending)]">
            To take bookings here, add {info.deskMissing.map((m) => MISSING_TEXT[m]).join(' and ')}.
          </p>
          <Button onClick={() => void start(info.deskMissing)} disabled={starting}>
            {starting ? 'Opening…' : 'Set up booking · takes about 5 minutes'}
          </Button>
        </div>
      )}

      {info.mode === 'DESK' && info.deskBookingUrl && (
        <p className="text-[13px] text-[var(--desk-text-body)]">
          Your Book button opens <a className="font-semibold text-[var(--desk-pine-600)] underline" href={info.deskBookingUrl} target="_blank" rel="noreferrer">{info.deskBookingUrl}</a>
        </p>
      )}

      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => void save()} disabled={saving || unchanged || deskBlocked || (mode === 'EXTERNAL' && !link.trim())}>
          {saving ? 'Saving…' : 'Save booking choice'}
        </Button>
      </div>
    </fieldset>
  );
}
