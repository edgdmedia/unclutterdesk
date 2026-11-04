import React from 'react';
import { API_BASE } from '../../utils/apiClient';
import { initialsOf } from '../../utils/initials';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, User } from 'lucide-react';
import { useBrand } from '@unclutterdesk/ui';
import { TransferDetails, type ManualPayment } from '../../components/payments/TransferDetails';
import { JoinButton } from '../../components/video/JoinButton';

type BookingState = {
  booking?: {
    bookingId: string;
    icalToken?: string;
    startsAt: string;
    endsAt: string;
    serviceTitle: string;
    therapistName: string;
    /** SET-06 / VID-01: online sessions are joined in the room on the portal. */
    format?: string;
    status: string;
    manualPayment?: ManualPayment | null;
  };
  fullName?: string;
  email?: string;
};

/** Optional preview data for Brand settings page. When provided, renders a
 * sample confirmed session instead of "No booking confirmation found". */
export interface PreviewBooking {
  bookingId: string;
  icalToken?: string;
  startsAt: string;
  endsAt: string;
  serviceTitle: string;
  therapistName: string;
  format?: string;
  status: string;
  manualPayment?: ManualPayment | null;
}

interface BookingConfirmedPageProps {
  /** Preview sample for Brand page; not used on the real confirmed page. */
  preview?: PreviewBooking;
}

export function BookingConfirmedPage({ preview }: BookingConfirmedPageProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as BookingState | null) || {};
  const booking = state.booking ?? preview;
  const brand = useBrand();
  const primaryColor = brand.primaryColor || '#0F3A53';

  if (!booking) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--desk-text-body)]">No booking confirmation found.</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--desk-surface-alt)] text-[var(--desk-text)] font-outfit flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[560px] space-y-6 text-center">
        <div className="h-[72px] w-[72px] rounded-[26px] mx-auto flex items-center justify-center text-white shadow-xl" style={{ backgroundColor: primaryColor }}><Check className="h-9 w-9 stroke-[3]" /></div>
        <div>
          <h1 className="text-[32px] font-extrabold tracking-[-0.035em] text-[var(--desk-text)]">{booking.manualPayment ? 'Your time is held' : 'Your session is booked'}</h1>
          <p className="text-[15px] text-[var(--desk-text-body)] font-medium max-w-[460px] mx-auto mt-2 leading-relaxed">
            {booking.manualPayment
              ? 'Send the transfer below to confirm it. We have emailed you these details too.'
              : 'Now create your client account so you can sign in, manage sessions, and join telehealth rooms securely.'}
          </p>
        </div>
        {booking.manualPayment ? (
          <TransferDetails payment={booking.manualPayment} bookingId={booking.bookingId} email={state.email} color={primaryColor} />
        ) : null}
        <div className="rounded-[24px] bg-white border border-[var(--desk-border)] shadow-[0_12px_34px_rgba(15,23,42,.09)] overflow-hidden text-left space-y-4">
          <div className="p-[20px_24px] border-b border-[var(--desk-border)] flex items-center justify-between"><div className="flex items-center gap-3"><div className="h-[46px] w-[46px] rounded-[14px] bg-[var(--desk-pine-600)]/10 text-[var(--desk-pine-600)] font-extrabold flex items-center justify-center text-base">{initialsOf(booking.therapistName)}</div><div><h3 className="text-[15.5px] font-bold text-[var(--desk-text)]">{booking.therapistName}</h3><p className="text-[12.5px] text-[var(--desk-text-muted)] font-medium">{booking.serviceTitle}</p></div></div><span className={`h-6 px-3 rounded-full text-xs font-bold border flex items-center ${booking.manualPayment ? 'bg-[var(--desk-pending-bg)] text-[var(--desk-pending)] border-amber-200' : 'bg-[var(--desk-active-bg)] text-[var(--desk-active)] border-[var(--desk-active-border)]'}`}>{booking.manualPayment ? 'AWAITING TRANSFER' : booking.status}</span></div>
          <div className="px-[24px] space-y-3 text-[13.5px]">
            <div className="flex items-center justify-between"><span className="text-[12.5px] font-semibold text-[var(--desk-text-subtle)] w-[100px]">Booking ref</span><span className="font-mono font-bold text-[var(--desk-text)]">{booking.bookingId}</span></div>
            <div className="flex items-center justify-between"><span className="text-[12.5px] font-semibold text-[var(--desk-text-subtle)] w-[100px]">Date</span><span className="font-bold text-[var(--desk-text)]">{new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(booking.startsAt))}</span></div>
            <div className="flex items-center justify-between"><span className="text-[12.5px] font-semibold text-[var(--desk-text-subtle)] w-[100px]">Time</span><span className="font-bold text-[var(--desk-text)]">{new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(booking.startsAt))}</span></div>
          </div>
          <div className="p-[0_24px_24px] grid grid-cols-1 gap-3 pt-2">
            <button onClick={() => navigate('/client/create-account', { state: { fullName: state.fullName, email: state.email } })} className="os-brand-btn h-[48px] rounded-[16px] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer" style={{ backgroundColor: primaryColor }}><User className="h-4 w-4" /><span>Create client account</span></button>
            <Link to="/login" state={{ email: state.email }} className="h-[48px] rounded-[16px] bg-[var(--desk-surface-muted)] text-[var(--desk-text-body)] font-bold text-sm hover:bg-[var(--desk-border)] flex items-center justify-center gap-2 cursor-pointer"><ArrowLeft className="h-4 w-4" /><span>Already have an account? Sign in</span></Link>
            <a href={`${API_BASE}/v1/calendar/bookings/${booking.bookingId}/ical?token=${booking.icalToken ?? ''}`} download className="h-[48px] rounded-[16px] bg-white border border-[var(--desk-border)] text-[var(--desk-text-body)] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span>Add to Calendar</span></a>
            {booking.status === 'CONFIRMED' && booking.format !== 'IN_PERSON' ? (
              <JoinButton
                startsAt={booking.startsAt}
                endsAt={booking.endsAt}
                to={`/portal/sessions/${booking.bookingId}/room`}
                className="h-[48px] rounded-[16px] bg-white border border-[var(--desk-border)] text-[var(--desk-text-body)] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                waitingClassName="h-[48px] rounded-[16px] bg-[var(--desk-surface-muted)] text-[var(--desk-text-muted)] font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed"
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
