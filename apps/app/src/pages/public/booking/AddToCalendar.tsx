import React, { useEffect, useRef, useState } from 'react';
import { CalendarPlus, ChevronDown } from 'lucide-react';

/** 20261006T103000Z */
const gcalTime = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function googleCalendarUrl(b: { serviceTitle: string; therapistName: string; startsAt: string; endsAt: string }): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${b.serviceTitle} with ${b.therapistName}`,
    dates: `${gcalTime(b.startsAt)}/${gcalTime(b.endsAt)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * POR-05: one button, two ways to put the session in a calendar (BKG-12).
 * Shared by the booking confirmation and the portal's session cards.
 * `placement` is where the menu opens: ConfirmationStep has the button near
 * the page bottom so its menu goes 'above'; a portal card sits near the top,
 * so the card passes 'below' rather than opening off-screen.
 */
export function AddToCalendar({
  bookingId,
  icalToken,
  serviceTitle,
  therapistName,
  startsAt,
  endsAt,
  placement = 'above',
  apiBase = '',
}: {
  bookingId: string;
  icalToken?: string;
  serviceTitle: string;
  therapistName: string;
  startsAt: string;
  endsAt: string;
  placement?: 'above' | 'below';
  apiBase?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const item = 'w-full text-left px-3.5 py-2.5 text-[13.5px] font-semibold text-[#0F172A] hover:bg-[#F1F5F9] block';
  const icsHref = `${apiBase}/v1/calendar/bookings/${bookingId}/ical?token=${icalToken ?? ''}`;
  const googleHref = googleCalendarUrl({ serviceTitle, therapistName, startsAt, endsAt });
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="h-11 px-5 rounded-[14px] border border-[#CBD5E1] bg-white text-[14px] font-semibold text-[#0F172A] inline-flex items-center gap-2 cursor-pointer"
      >
        <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add to calendar
        <ChevronDown className={`h-4 w-4 text-[#64748B] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open ? (
        <div role="menu" className={`absolute left-0 ${placement === 'below' ? 'top-full mt-2' : 'bottom-full mb-2'} w-[240px] rounded-[14px] border border-[#E2E8F0] bg-white shadow-xl py-1.5 z-20`}>
          <a role="menuitem" className={item} href={icsHref} download>Download (.ics)</a>
          <a role="menuitem" className={item} href={googleHref} target="_blank" rel="noreferrer">Google Calendar</a>
        </div>
      ) : null}
    </div>
  );
}
