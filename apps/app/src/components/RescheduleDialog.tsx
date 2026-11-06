import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { api } from '../utils/apiClient';
import { useToast } from '@unclutterdesk/ui';
import { formatClock } from '../utils/displayFormat';
import { SlotDayPicker } from './booking/SlotDayPicker';

interface Slot {
  id: string;
  startsAt: string;
  endsAt: string;
  channel: string;
}

interface Options {
  bookingId: string;
  serviceTitle: string;
  currentStartsAt: string;
  noticeHours: number;
  slots: Slot[];
}

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

function formatMoment(iso: string): string {
  const at = new Date(iso);
  return `${DAY.format(at)} at ${formatClock(at)}`;
}

/**
 * Moving one session to another time.
 *
 * The options come from the server rather than the full public availability
 * list, so what is offered and what the reschedule will accept cannot drift
 * apart — same practitioner, same service, outside the practice's notice
 * period. The same call is also what tells us the session is too close to move,
 * which is why the refusal is rendered here rather than guessed in the portal.
 */
/** A paid session with no time yet (§11.2): the same dialog books its first time. */
export interface OpenPlanSession {
  id: string;
  serviceTitle: string;
  provider: { name: string };
}

export function RescheduleDialog({
  bookingId,
  planSession,
  primaryColor,
  onClose,
  onRescheduled,
}: {
  /** Move this booked session… */
  bookingId?: string;
  /** …or choose the first time for this not-yet-scheduled one. */
  planSession?: OpenPlanSession;
  primaryColor: string;
  onClose: () => void;
  onRescheduled: () => void;
}) {
  const choosing = Boolean(planSession);
  // Both answer with the times the booking itself will accept.
  const load = (): Promise<Options> =>
    planSession
      ? api.get<Slot[]>(`/v1/consult/portal/plan-sessions/${planSession.id}/options`).then((slots) => ({
          bookingId: '',
          serviceTitle: planSession.serviceTitle,
          currentStartsAt: '',
          noticeHours: 0,
          slots: slots ?? [],
        }))
      : api.get<Options>(`/v1/consult/portal/bookings/${bookingId}/reschedule-options`);
  const toast = useToast();
  const [options, setOptions] = useState<Options | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setOptions(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'We could not load other times right now.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId, planSession?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function confirm() {
    if (!selected || saving) return;
    setSaving(true);
    setSubmitError(null);
    try {
      await api.post(
        planSession ? `/v1/consult/portal/plan-sessions/${planSession.id}/schedule` : `/v1/consult/portal/bookings/${bookingId}/reschedule`,
        { availabilityId: selected },
      );
      onRescheduled();
      toast.success(choosing ? 'Session booked' : 'Session rescheduled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : choosing ? 'Could not book that time' : 'Could not reschedule the session');
      // Most often the slot went while the client was choosing. Reload the
      // list so they are not staring at a time that is already gone.
      setSubmitError(err instanceof Error ? err.message : 'We could not move your session.');
      setSaving(false);
      setSelected(null);
      load()
        .then(setOptions)
        .catch(() => undefined);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={choosing ? 'Choose a time' : 'Move this session'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[460px] max-h-[86vh] flex flex-col bg-white rounded-[22px] shadow-[0_24px_70px_rgba(15,23,42,0.28)]">
        <div className="flex items-start gap-3 p-[22px_24px_16px] border-b border-[var(--desk-border-soft)]">
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[var(--desk-text)]">
              {choosing ? 'Choose a time' : 'Move this session'}
            </h2>
            {planSession ? (
              <p className="mt-1 text-[12.5px] text-[var(--desk-text-muted)] leading-[1.55]">
                {planSession.serviceTitle} with {planSession.provider.name} · already paid
              </p>
            ) : options ? (
              <p className="mt-1 text-[12.5px] text-[var(--desk-text-muted)] leading-[1.55]">
                {options.serviceTitle} · currently {formatMoment(options.currentStartsAt)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 flex-none rounded-[10px] text-[var(--desk-text-subtle)] hover:bg-[var(--desk-surface-muted)] flex items-center justify-center cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-[16px_24px]">
          {loadError ? (
            <div className="flex items-start gap-2 rounded-[14px] bg-[var(--desk-danger-bg)] p-3 text-[12.5px] leading-[1.55] text-[var(--desk-danger)]">
              <AlertCircle className="h-4 w-4 flex-none mt-[1px]" />
              <span>{loadError}</span>
            </div>
          ) : !options ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--desk-text-subtle)]" aria-label="Loading times" />
            </div>
          ) : options.slots.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[var(--desk-text-muted)] leading-[1.6]">
              {choosing
                ? 'Your therapist has no open times at the moment. Please contact the practice and they will find one for you.'
                : 'Your therapist has no other open times at the moment. Please contact the practice and they will find one for you.'}
            </p>
          ) : (
            <SlotDayPicker
              name="reschedule-slot"
              slots={options.slots}
              value={selected ?? ''}
              onChange={(slot) => setSelected(slot.id)}
              accent={primaryColor}
            />
          )}

          {submitError ? (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-[14px] bg-[var(--desk-danger-bg)] p-3 text-[12.5px] leading-[1.55] text-[var(--desk-danger)]"
            >
              <AlertCircle className="h-4 w-4 flex-none mt-[1px]" />
              <span>{submitError}</span>
            </div>
          ) : null}
        </div>

        <div className="flex gap-3 p-[16px_24px_22px] border-t border-[var(--desk-border-soft)]">
          <button
            type="button"
            onClick={onClose}
            className="h-[46px] flex-1 rounded-[14px] border border-[var(--desk-border)] text-[13.5px] font-bold text-[var(--desk-text-body)] cursor-pointer hover:bg-[var(--desk-surface)]"
          >
            {choosing ? 'Not now' : 'Keep current time'}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!selected || saving}
            className="h-[46px] flex-1 rounded-[14px] text-white text-[13.5px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? (choosing ? 'Booking…' : 'Moving…') : choosing ? 'Book this time' : 'Move session'}
          </button>
        </div>
      </div>
    </div>
  );
}
