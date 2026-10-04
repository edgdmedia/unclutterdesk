import React from 'react';
import { API_BASE } from '../../../utils/apiClient';
import { AddToCalendar } from '../../public/booking/AddToCalendar';
import { JoinButton } from '../../../components/video/JoinButton';
import { DateTile } from './DateTile';
import { formatMoney, formatTimeRange } from './portalFormat';
import type { PortalSession } from './PortalDataContext';

/** One upcoming session row: what, when, what it cost, and what you can do. */
export function PortalSessionCard({ session, onReschedule }: { session: PortalSession; onReschedule(id: string): void }) {
  return (
    <div className="flex items-center gap-4 px-5 py-[16px] flex-wrap">
      <DateTile startsAt={session.startsAt} />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-bold text-[#0F172A]">{session.serviceTitle}</div>
        <div className="text-[12px] text-[#64748B] font-medium">{formatTimeRange(session.startsAt, session.endsAt)} · with {session.therapistName}</div>
      </div>
      <div className="text-right">
        <div className="text-[13.5px] font-extrabold text-[#0F172A]">{formatMoney(session.priceKobo)}</div>
        <div className="text-[11px] text-[#94A3B8] font-medium">{session.status}</div>
      </div>
      {session.status !== 'CANCELLED' && session.icalToken ? (
        <AddToCalendar
          placement="below"
          apiBase={API_BASE}
          bookingId={session.id}
          icalToken={session.icalToken}
          serviceTitle={session.serviceTitle}
          therapistName={session.therapistName}
          startsAt={session.startsAt}
          endsAt={session.endsAt}
        />
      ) : null}
      {session.status !== 'CANCELLED' ? (
        <button
          type="button"
          onClick={() => onReschedule(session.id)}
          className="h-[34px] px-3 rounded-[10px] border border-[#E2E8F0] text-[12px] font-bold text-[#475569] hover:bg-[#F8FAFC] cursor-pointer"
        >
          Reschedule
        </button>
      ) : null}
      {session.status === 'CONFIRMED' && session.format !== 'IN_PERSON' ? (
        <JoinButton startsAt={session.startsAt} endsAt={session.endsAt} to={`/portal/sessions/${session.id}/room`} />
      ) : null}
    </div>
  );
}
