import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api, TENANT_SLUG } from '../../utils/apiClient';
import { useAuth } from '../../context/AuthContext';
import { formatWhen } from '../../utils/displayFormat';
import { SlotDayPicker, type PickableSlot } from './SlotDayPicker';

export interface MoveSession {
  id: string;
  serviceId?: string | null;
  serviceTitle: string;
  startsAt: string;
  durationMinutes?: number | null;
  format?: string;
  client: { name: string };
  provider: { id: string; name: string };
}

/**
 * The When part of Edit session. Staff move a session to another time: one of the practitioner's open times,
 * or a time they type in when the client asks for one the weekly hours don't
 * offer. The open times are the ones the booking page would offer for this
 * service and format, so a move never lands where the booking could not.
 * The API emails the client the new time.
 */
export function MoveSessionPanel({
  session,
  onMoved,
}: {
  session: MoveSession;
  onMoved: (r: { startsAt: string }) => void;
}) {
  const { profile } = useAuth();
  // The public availability endpoint names the practice by host; localhost has none.
  const tenantHeaders = TENANT_SLUG || profile?.tenantSlug ? { 'X-Tenant-Slug': TENANT_SLUG || String(profile?.tenantSlug) } : undefined;
  const format = session.format === 'IN_PERSON' ? 'IN_PERSON' : 'ONLINE';

  const [mode, setMode] = useState<'slot' | 'custom'>('slot');
  const [slots, setSlots] = useState<PickableSlot[] | null>(null);
  const [slotId, setSlotId] = useState('');
  const [customAt, setCustomAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session.serviceId) return setSlots([]);
    api
      .get<PickableSlot[]>(
        `/v1/consult/public/availability?providerProfileId=${session.provider.id}&serviceId=${session.serviceId}&format=${format}`,
        tenantHeaders,
      )
      .then((rows) => setSlots((rows ?? []).filter((s) => s.startsAt !== session.startsAt)))
      .catch(() => setSlots([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.provider.id, session.serviceId, format, session.startsAt]);

  const chosen = mode === 'slot' ? slots?.find((s) => s.id === slotId)?.startsAt ?? null : customAt ? new Date(customAt).toISOString() : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ startsAt: string }>(
        `/v1/consult/practice/sessions/${session.id}/reschedule`,
        mode === 'slot' ? { availabilityId: slotId } : { startsAt: chosen },
      );
      onMoved(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not move the session');
      setBusy(false);
    }
  }

  const radio = (checked: boolean) =>
    `flex items-start gap-2 p-2.5 rounded-[12px] border cursor-pointer ${checked ? 'border-[var(--desk-pine-600)] bg-[var(--desk-surface-alt)]' : 'border-[var(--desk-border)]'}`;

  return (
    <form onSubmit={submit} className="space-y-5">
        <p className="text-[12.5px] text-[var(--desk-text-body)]">
          {session.serviceTitle} with {session.provider.name}, now {formatWhen(session.startsAt, 'long')}.
        </p>

        <fieldset className="space-y-2">
          <legend className="text-[12px] font-semibold text-[var(--desk-text-body)] mb-1">New time</legend>
          <div className="flex gap-2">
            <label className={radio(mode === 'slot')}><input type="radio" name="move-mode" checked={mode === 'slot'} onChange={() => setMode('slot')} aria-label="Open times" /><span className="text-[13px]">Open times</span></label>
            <label className={radio(mode === 'custom')}><input type="radio" name="move-mode" checked={mode === 'custom'} onChange={() => setMode('custom')} aria-label="Custom time" /><span className="text-[13px]">Custom time</span></label>
          </div>
          {mode === 'slot' ? (
            slots === null ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-[var(--desk-text-muted)]" /></div>
            ) : slots.length ? (
              <SlotDayPicker name="move-slot" slots={slots} value={slotId} onChange={(s) => setSlotId(s.id)} />
            ) : (
              <p className="text-[12px] text-[var(--desk-text-muted)]">No open times. Use a custom time.</p>
            )
          ) : (
            <label className="block text-[12px] font-semibold text-[var(--desk-text-body)]">
              Date and time
              <input type="datetime-local" aria-label="Date and time" className="mt-1 w-full h-[40px] px-3 rounded-[12px] border border-[var(--desk-border)] text-[13px]" value={customAt} onChange={(e) => setCustomAt(e.target.value)} />
              <span className="block mt-1 text-[11.5px] font-normal text-[var(--desk-text-muted)]">
                This can fall outside working hours. Any open time it overlaps is closed.
                {session.durationMinutes ? ` The session runs for ${session.durationMinutes} minutes.` : ''}
              </span>
            </label>
          )}
        </fieldset>

        <p className="text-[11.5px] text-[var(--desk-text-muted)]">The client is emailed the new time.</p>

        {error ? <p role="alert" className="text-[12px] font-medium text-rose-700">{error}</p> : null}
        <button type="submit" disabled={busy || !chosen} className="w-full h-[42px] rounded-[12px] bg-[var(--desk-pine-600)] text-white text-[13px] font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {chosen ? `Move to ${formatWhen(chosen, 'short')}` : 'Move to…'}
        </button>
    </form>
  );
}
