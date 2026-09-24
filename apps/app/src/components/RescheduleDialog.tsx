import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { api } from '../utils/apiClient';

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
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

function formatSlot(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  return `${DAY.format(start)} · ${TIME.format(start)} — ${TIME.format(new Date(endsAt))}`;
}

function formatMoment(iso: string): string {
  const at = new Date(iso);
  return `${DAY.format(at)} at ${TIME.format(at)}`;
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
export function RescheduleDialog({
  bookingId,
  primaryColor,
  onClose,
  onRescheduled,
}: {
  bookingId: string;
  primaryColor: string;
  onClose: () => void;
  onRescheduled: () => void;
}) {
  const [options, setOptions] = useState<Options | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Options>(`/v1/consult/portal/bookings/${bookingId}/reschedule-options`)
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
  }, [bookingId]);

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
      await api.post(`/v1/consult/portal/bookings/${bookingId}/reschedule`, {
        availabilityId: selected,
      });
      onRescheduled();
    } catch (err) {
      // Most often the slot went while the client was choosing. Reload the
      // list so they are not staring at a time that is already gone.
      setSubmitError(err instanceof Error ? err.message : 'We could not move your session.');
      setSaving(false);
      setSelected(null);
      api
        .get<Options>(`/v1/consult/portal/bookings/${bookingId}/reschedule-options`)
        .then(setOptions)
        .catch(() => undefined);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Move this session"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[460px] max-h-[86vh] flex flex-col bg-white rounded-[22px] shadow-[0_24px_70px_rgba(15,23,42,0.28)]">
        <div className="flex items-start gap-3 p-[22px_24px_16px] border-b border-[#F1F5F9]">
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[#0F172A]">
              Move this session
            </h2>
            {options ? (
              <p className="mt-1 text-[12.5px] text-[#64748B] leading-[1.55]">
                {options.serviceTitle} · currently {formatMoment(options.currentStartsAt)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 flex-none rounded-[10px] text-[#94A3B8] hover:bg-[#F1F5F9] flex items-center justify-center cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-[16px_24px]">
          {loadError ? (
            <div className="flex items-start gap-2 rounded-[14px] bg-[#FEF2F2] p-3 text-[12.5px] leading-[1.55] text-[#B91C1C]">
              <AlertCircle className="h-4 w-4 flex-none mt-[1px]" />
              <span>{loadError}</span>
            </div>
          ) : !options ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#94A3B8]" aria-label="Loading times" />
            </div>
          ) : options.slots.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[#64748B] leading-[1.6]">
              Your therapist has no other open times at the moment. Please contact the practice and
              they will find one for you.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {options.slots.map((slot) => (
                <label
                  key={slot.id}
                  className={`flex items-center gap-3 px-4 h-[52px] rounded-[14px] border cursor-pointer transition-colors ${
                    selected === slot.id
                      ? 'border-transparent bg-[#F1F5F9]'
                      : 'border-[#E2E8F0] hover:bg-[#F8FAFC]'
                  }`}
                  style={selected === slot.id ? { boxShadow: `inset 0 0 0 2px ${primaryColor}` } : undefined}
                >
                  <input
                    type="radio"
                    name="reschedule-slot"
                    value={slot.id}
                    checked={selected === slot.id}
                    onChange={() => setSelected(slot.id)}
                    className="accent-[#0F3A53]"
                  />
                  <span className="text-[13.5px] font-semibold text-[#0F172A]">
                    {formatSlot(slot.startsAt, slot.endsAt)}
                  </span>
                </label>
              ))}
            </div>
          )}

          {submitError ? (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-[14px] bg-[#FEF2F2] p-3 text-[12.5px] leading-[1.55] text-[#B91C1C]"
            >
              <AlertCircle className="h-4 w-4 flex-none mt-[1px]" />
              <span>{submitError}</span>
            </div>
          ) : null}
        </div>

        <div className="flex gap-3 p-[16px_24px_22px] border-t border-[#F1F5F9]">
          <button
            type="button"
            onClick={onClose}
            className="h-[46px] flex-1 rounded-[14px] border border-[#E2E8F0] text-[13.5px] font-bold text-[#475569] cursor-pointer hover:bg-[#F8FAFC]"
          >
            Keep current time
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!selected || saving}
            className="h-[46px] flex-1 rounded-[14px] text-white text-[13.5px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? 'Moving…' : 'Move session'}
          </button>
        </div>
      </div>
    </div>
  );
}
