import React from 'react';
import { initialsOf } from '../../utils/initials';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, Video, ArrowLeft, User } from 'lucide-react';
import { useBrand } from '@unclutterdesk/ui';

type BookingState = {
  booking?: {
    bookingId: string;
    icalToken?: string;
    startsAt: string;
    endsAt: string;
    serviceTitle: string;
    therapistName: string;
    videoRoomLink: string;
    status: string;
  };
  fullName?: string;
  email?: string;
};

export function BookingConfirmedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as BookingState | null) || {};
  const booking = state.booking;
  const brand = useBrand();
  const primaryColor = brand.primaryColor || '#0F3A53';

  if (!booking) {
    return <div className="min-h-screen flex items-center justify-center text-[#475569]">No booking confirmation found.</div>;
  }

  return (
    <div className="min-h-screen bg-[#FCFDFE] text-[#0F172A] font-outfit flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[560px] space-y-6 text-center">
        <div className="h-[72px] w-[72px] rounded-[26px] mx-auto flex items-center justify-center text-white shadow-xl" style={{ backgroundColor: primaryColor }}><Check className="h-9 w-9 stroke-[3]" /></div>
        <div>
          <h1 className="text-[32px] font-extrabold tracking-[-0.035em] text-[#0F172A]">Your session is booked</h1>
          <p className="text-[15px] text-[#475569] font-medium max-w-[460px] mx-auto mt-2 leading-relaxed">Now create your client account so you can sign in, manage sessions, and join telehealth rooms securely.</p>
        </div>
        <div className="rounded-[24px] bg-white border border-[#E2E8F0] shadow-[0_12px_34px_rgba(15,23,42,.09)] overflow-hidden text-left space-y-4">
          <div className="p-[20px_24px] border-b border-[#E2E8F0] flex items-center justify-between"><div className="flex items-center gap-3"><div className="h-[46px] w-[46px] rounded-[14px] bg-[#0F3A53]/10 text-[#0F3A53] font-extrabold flex items-center justify-center text-base">{initialsOf(booking.therapistName)}</div><div><h3 className="text-[15.5px] font-bold text-[#0F172A]">{booking.therapistName}</h3><p className="text-[12.5px] text-[#64748B] font-medium">{booking.serviceTitle}</p></div></div><span className="h-6 px-3 rounded-full bg-[#ECFDF5] text-[#059669] text-xs font-bold border border-[#A7F3D0]">{booking.status}</span></div>
          <div className="px-[24px] space-y-3 text-[13.5px]">
            <div className="flex items-center justify-between"><span className="text-[12.5px] font-semibold text-[#94A3B8] w-[100px]">Booking ref</span><span className="font-mono font-bold text-[#0F172A]">{booking.bookingId}</span></div>
            <div className="flex items-center justify-between"><span className="text-[12.5px] font-semibold text-[#94A3B8] w-[100px]">Date</span><span className="font-bold text-[#0F172A]">{new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(booking.startsAt))}</span></div>
            <div className="flex items-center justify-between"><span className="text-[12.5px] font-semibold text-[#94A3B8] w-[100px]">Time</span><span className="font-bold text-[#0F172A]">{new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(booking.startsAt))}</span></div>
            <div className="flex items-center justify-between"><span className="text-[12.5px] font-semibold text-[#94A3B8] w-[100px]">Video Link</span><a href={booking.videoRoomLink} target="_blank" rel="noreferrer" className="font-mono text-xs font-bold text-blue-600 underline flex items-center gap-1"><Video className="h-3.5 w-3.5" /><span>{booking.videoRoomLink.replace('https://', '')}</span></a></div>
          </div>
          <div className="p-[0_24px_24px] grid grid-cols-1 gap-3 pt-2">
            <button onClick={() => navigate('/client/create-account', { state: { fullName: state.fullName, email: state.email } })} className="os-brand-btn h-[48px] rounded-[16px] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer" style={{ backgroundColor: primaryColor }}><User className="h-4 w-4" /><span>Create client account</span></button>
            <Link to="/login" state={{ email: state.email }} className="h-[48px] rounded-[16px] bg-[#F1F5F9] text-[#475569] font-bold text-sm hover:bg-[#E2E8F0] flex items-center justify-center gap-2 cursor-pointer"><ArrowLeft className="h-4 w-4" /><span>Already have an account? Sign in</span></Link>
            <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/v1/calendar/bookings/${booking.bookingId}/ical?token=${booking.icalToken ?? ''}`} download className="h-[48px] rounded-[16px] bg-white border border-[#E2E8F0] text-[#334155] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span>Add to Calendar</span></a>
            <a href={booking.videoRoomLink} target="_blank" rel="noreferrer" className="h-[48px] rounded-[16px] bg-white border border-[#E2E8F0] text-[#334155] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"><Video className="h-4 w-4" /><span>Join session</span></a>
          </div>
        </div>
      </div>
    </div>
  );
}
