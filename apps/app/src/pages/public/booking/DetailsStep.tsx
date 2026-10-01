import React from 'react';
import { ClientAuthPanel } from '../ClientAuthPanel';
import { initialsOf } from '../../../utils/initials';

export type BookingClient = { firstName?: string | null; lastName?: string | null; email: string; phone?: string | null };

/** Step 3: who is booking, and an optional note for the therapist (README, Step 3). */
export function DetailsStep({
  me,
  onSignOut,
  onSignedIn,
  note,
  onNote,
  therapistName,
}: {
  me: BookingClient | null;
  onSignOut: () => void;
  onSignedIn: () => void;
  note: string;
  onNote: (note: string) => void;
  therapistName?: string | null;
}) {
  const name = [me?.firstName, me?.lastName].filter(Boolean).join(' ');
  return (
    <div className="flex flex-col gap-5">
      {me ? (
        <div className="rounded-[18px] bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-3.5 flex items-center gap-3">
          <span className="h-11 w-11 rounded-full inline-flex items-center justify-center text-[14px] font-extrabold shrink-0" style={{ background: 'var(--brand-fill)', color: 'var(--brand-ink, var(--brand-primary))' }}>
            {initialsOf(name || me.email, '?')}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14.5px] font-bold text-[#0F172A]">Booking as {name || me.email}</div>
            <div className="text-[12.5px] text-[#64748B] truncate">{[me.email, me.phone].filter(Boolean).join(' · ')}</div>
          </div>
          <button type="button" onClick={onSignOut} className="h-11 px-1 text-[13px] font-bold cursor-pointer shrink-0" style={{ color: 'var(--brand-ink, var(--brand-primary))' }}>
            Not you?
          </button>
        </div>
      ) : (
        <ClientAuthPanel onDone={onSignedIn} />
      )}

      <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-[#475569]">
        <span>
          Anything the therapist should know before the first session? <span className="font-medium text-[#94A3B8]">Optional</span>
        </span>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder={`Shared only with ${therapistName || 'your therapist'}.`}
          className="w-full px-3.5 py-3 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[14.5px] font-normal text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8] focus:shadow-[0_0_0_3px_var(--brand-ring)]"
        />
      </label>
    </div>
  );
}
