import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/apiClient';
import { useToast } from '@unclutterdesk/ui';

type LapseSession = { id: string; startsAt: string; clientName: string; practitionerName: string };
type LapseStatus =
  | { lapsing: false }
  | { lapsing: true; lapsedAt: string; noticeFrom: string; downgradeAt: string; inNotice: boolean; sessions: LapseSession[] };
type OwnSlot = { id: string; startsAt: string; endsAt: string; isActive: boolean; booked: boolean };

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });
const WHEN = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });

/**
 * A lapsing paid plan, on the owner's dashboard (spec §5.4a). During grace it
 * asks for the renewal; in the notice period it gives the exact date the
 * practice moves to Free and lists upcoming sessions with staff who will be
 * paused, each of which the owner can take over, reschedule or cancel.
 */
export function LapseNotice() {
  const toast = useToast();
  const [status, setStatus] = useState<LapseStatus | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [ownSlots, setOwnSlots] = useState<OwnSlot[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<LapseStatus>('/v1/billing/lapse').then(setStatus).catch(() => setStatus(null));
  }, []);
  useEffect(load, [load]);

  async function openPicker(bookingId: string) {
    setPicking(bookingId);
    if (ownSlots) return;
    try {
      const data = await api.get<{ slots: OwnSlot[] }>('/v1/consult/therapist/availability');
      setOwnSlots((data.slots ?? []).filter((s) => s.isActive && !s.booked));
    } catch {
      setOwnSlots([]);
    }
  }

  async function takeOver(bookingId: string, availabilityId: string) {
    setBusy(true);
    try {
      await api.post(`/v1/consult/practice/sessions/${bookingId}/reassign-to-me`, { availabilityId });
      toast.success('The session is now yours');
      setPicking(null);
      setOwnSlots(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not move the session');
    } finally {
      setBusy(false);
    }
  }

  if (!status?.lapsing) return null;
  const date = DATE.format(new Date(status.downgradeAt));
  return (
    <div role="status" className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <p className="text-sm font-semibold text-amber-900">
          {status.inNotice
            ? `Your practice moves to the free plan on ${date} unless you renew. Everyone except you will be paused then.`
            : "Your subscription hasn't renewed. Nothing has changed yet: renew to keep your plan as it is."}
        </p>
        <Link to="/dashboard/settings/subscription" className="h-9 px-4 rounded-[10px] bg-amber-900 text-white text-xs font-bold inline-flex items-center shrink-0">
          Renew plan
        </Link>
      </div>
      {status.inNotice && status.sessions.length ? (
        <div className="space-y-2">
          <p className="text-[13px] font-medium text-amber-900">
            Upcoming sessions with staff who will be paused. Take them over, reschedule or cancel them before {date}:
          </p>
          <ul className="space-y-1.5">
            {status.sessions.map((s) => (
              <li key={s.id} className="rounded-[12px] bg-white border border-amber-100 px-3 py-2 text-[13px] text-[#0F172A]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {WHEN.format(new Date(s.startsAt))} · {s.clientName} with {s.practitionerName}
                  </span>
                  <span className="flex gap-2">
                    <button type="button" onClick={() => void openPicker(s.id)} className="text-[12px] font-bold text-[#0F3A53] cursor-pointer">
                      Take it over
                    </button>
                    <Link to={`/dashboard/sessions/${s.id}`} className="text-[12px] font-bold text-[#0F3A53]">
                      Reschedule or cancel
                    </Link>
                  </span>
                </div>
                {picking === s.id ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ownSlots === null ? (
                      <span className="text-[12px] text-[#64748B]">Loading your open times…</span>
                    ) : ownSlots.length === 0 ? (
                      <span className="text-[12px] text-[#64748B]">You have no open times. Add some in Schedule, then come back.</span>
                    ) : (
                      ownSlots.slice(0, 12).map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={busy}
                          onClick={() => void takeOver(s.id, slot.id)}
                          className="h-8 px-2.5 rounded-[8px] border border-[#E2E8F0] text-[12px] font-semibold cursor-pointer hover:bg-[#F8FAFC] disabled:opacity-50"
                        >
                          {WHEN.format(new Date(slot.startsAt))}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
