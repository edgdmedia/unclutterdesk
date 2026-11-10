import React, { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, Eyebrow, useBrand } from '@unclutterdesk/ui';
import { api } from '../../../utils/apiClient';

type PortalJournal =
  | { available: false }
  | {
      available: true;
      title: string;
      intro: string | null;
      days: number;
      connected: boolean;
      addedAt: string | null;
      deliveryTime: string;
      progress: { total: number; responded: number } | null;
      journalUrl: string;
    };

const NOTICES: Record<string, string> = {
  added: 'Added to your Unclutter Journal. Your first prompt arrives tomorrow.',
  linked: 'Your Journal is connected. You can add the plan below.',
  declined: 'Nothing was connected. You can add it whenever you are ready.',
};

/**
 * The practitioner's daily plan on the client's recap page
 * (docs/design/journal-integration.md): added to her own Unclutter Journal
 * only when she chooses, at the time she chooses.
 */
export function PortalJournalCard({ bookingId, notice }: { bookingId: string; notice: string | null }) {
  const brand = useBrand();
  const primary = brand.primaryColor || '#0F3A53';
  const [j, setJ] = useState<PortalJournal | null>(null);
  const [time, setTime] = useState('08:00');
  const [busy, setBusy] = useState<'add' | 'disconnect' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/v1/consult/portal/sessions/${encodeURIComponent(bookingId)}/journal`;

  async function load() {
    const v = await api.get<PortalJournal>(base);
    setJ(v);
    if (v.available) setTime(v.deliveryTime);
  }

  useEffect(() => {
    load().catch(() => setJ({ available: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  if (!j || !j.available) return null;

  async function add() {
    if (!j || !j.available) return;
    setBusy('add');
    setError(null);
    try {
      if (j.connected) {
        await api.put(`${base}/plan`, { deliveryTime: time });
        await load();
      } else {
        // To Journal: she signs in there and sees what will be shared before anything is linked.
        const { url } = await api.post<{ url: string }>(`${base}/connect`, { deliveryTime: time });
        window.location.assign(url);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Try again in a moment.');
    }
    setBusy(null);
  }

  async function disconnect() {
    if (!window.confirm('Disconnect your Unclutter Journal from this practice? Its plans stop, and nothing more is shared. What you have written stays in your Journal.')) return;
    setBusy('disconnect');
    setError(null);
    try {
      await api.delete('/v1/consult/portal/journal/link');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Try again in a moment.');
    }
    setBusy(null);
  }

  const message = notice ? NOTICES[notice] : null;

  return (
    <Card padding="p-[22px_24px]" className="space-y-3">
      <Eyebrow>A DAILY PRACTICE FROM YOUR PRACTITIONER</Eyebrow>
      <div className="flex items-start gap-3">
        <BookOpen className="h-5 w-5 shrink-0 mt-0.5" style={{ color: primary }} aria-hidden />
        <div className="min-w-0 space-y-1">
          <h3 className="text-[15px] font-bold text-[var(--desk-text)]">{j.title}</h3>
          <p className="text-[12.5px] text-[var(--desk-text-muted)] font-medium">
            {j.days} {j.days === 1 ? 'day' : 'days'}, one short prompt a day
          </p>
          {j.intro ? <p className="text-[13.5px] text-[var(--desk-text)] whitespace-pre-line leading-relaxed">{j.intro}</p> : null}
        </div>
      </div>

      {message ? (
        <p role="status" className="text-[12.5px] font-semibold text-[var(--desk-text)] bg-[var(--desk-surface)] border border-[var(--desk-border)] rounded-[12px] px-3.5 py-2.5">
          {message}
        </p>
      ) : null}

      {j.addedAt ? (
        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--desk-active)]">
            <CheckCircle2 className="h-4 w-4" /> In your Unclutter Journal, each day at {j.deliveryTime}
          </p>
          {j.progress ? (
            <p className="text-[12.5px] text-[var(--desk-text-muted)] font-medium">
              {j.progress.responded} of {j.progress.total} days answered.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 items-center">
            <a href={j.journalUrl} target="_blank" rel="noopener noreferrer" className="h-[38px] px-4 rounded-[12px] text-white text-[12.5px] font-bold inline-flex items-center" style={{ backgroundColor: primary }}>
              Open my Journal
            </a>
            <button type="button" disabled={busy !== null} onClick={() => void disconnect()} className="h-[38px] px-4 rounded-[12px] bg-white border border-[var(--desk-border)] text-[var(--desk-text)] text-[12.5px] font-bold cursor-pointer disabled:opacity-50">
              {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[12.5px] text-[var(--desk-text-muted)] leading-relaxed">
            {j.connected
              ? 'Your Journal is connected to this practice.'
              : 'Unclutter Journal delivers it to you, privately. You will sign in or create a free account there, and see what is shared first: your practitioner sees how many prompts you answer, never your words unless you choose to share an entry.'}
          </p>
          <label className="flex items-center gap-2 text-[13px] text-[var(--desk-text)] font-medium">
            Send my prompt at
            <input
              type="time"
              aria-label="Prompt time"
              value={time}
              step={300}
              onChange={(e) => setTime(e.target.value || '08:00')}
              className="h-[38px] px-2.5 rounded-[10px] bg-white border border-[var(--desk-border)] text-[13px]"
            />
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void add()}
              className="h-[40px] px-4 rounded-[12px] text-white text-[13px] font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              style={{ backgroundColor: primary }}
            >
              {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add to my Unclutter Journal
            </button>
            {j.connected ? (
              <button type="button" disabled={busy !== null} onClick={() => void disconnect()} className="h-[40px] px-4 rounded-[12px] bg-white border border-[var(--desk-border)] text-[var(--desk-text)] text-[12.5px] font-bold cursor-pointer disabled:opacity-50">
                Disconnect
              </button>
            ) : null}
          </div>
        </div>
      )}
      {error ? <p role="alert" className="text-[12px] font-semibold text-rose-700">{error}</p> : null}
    </Card>
  );
}
