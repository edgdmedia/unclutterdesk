import React, { useEffect, useRef, useState } from 'react';
import { CalendarPlus, Check, ChevronDown, Clock, FileText } from 'lucide-react';
import { Eyebrow } from '@unclutterdesk/ui';
import { formatOf, whenLabel } from './bookingSlots';
import { naira } from './BookingShell';

export type ConfirmedBooking = {
  bookingId: string;
  icalToken?: string;
  startsAt: string;
  endsAt: string;
  therapistName: string;
  serviceTitle: string;
  manualPayment?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    reference: string;
    amountKobo: string;
    holdExpiresAt: string;
  } | null;
  /** Forms to fill in before the first session (BKG-06); absent until that ships. */
  forms?: Array<{ title: string; kind: string; minutes: number; href: string }>;
};

const HOLD_MS = 48 * 60 * 60 * 1000;
const MONO: React.CSSProperties = { fontFamily: '"JetBrains Mono", ui-monospace, monospace' };

const pad = (n: number) => String(n).padStart(2, '0');
function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** 20261006T103000Z */
const gcalTime = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function googleCalendarUrl(b: ConfirmedBooking) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${b.serviceTitle} with ${b.therapistName}`,
    dates: `${gcalTime(b.startsAt)}/${gcalTime(b.endsAt)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function CopyRow({ label, value, copyLabel }: { label: string; value: string; copyLabel?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // The value is on screen to copy by hand.
    }
  }
  return (
    <div className="flex items-center gap-3 py-2.5 border-t border-[#E2E8F0] first:border-t-0">
      <span className="w-[110px] shrink-0 text-[13px] text-[#64748B]">{label}</span>
      <span className="flex-1 text-[14px] font-semibold text-[#0F172A] break-all" style={copyLabel ? MONO : undefined}>{value}</span>
      {copyLabel ? (
        <button type="button" aria-label={copyLabel} onClick={() => void copy()} className="h-9 px-3 rounded-[10px] border border-[#CBD5E1] bg-white text-[12.5px] font-bold text-[#0F172A] cursor-pointer shrink-0">
          {copied ? 'Copied' : 'Copy'}
        </button>
      ) : null}
    </div>
  );
}

function BankDetails({ payment }: { payment: NonNullable<ConfirmedBooking['manualPayment']> }) {
  return (
    <div className="rounded-[20px] bg-[#F8FAFC] px-4 py-1.5">
      <CopyRow label="Bank" value={payment.bankName} />
      <CopyRow label="Account name" value={payment.accountName} />
      <CopyRow label="Account number" value={payment.accountNumber} copyLabel="Copy account number" />
      <CopyRow label="Reference" value={payment.reference} copyLabel="Copy reference" />
    </div>
  );
}

/** One button, two ways to put the session in a calendar (BKG-12). */
function CalendarMenu({ icsHref, googleHref }: { icsHref: string; googleHref: string }) {
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
        <div role="menu" className="absolute left-0 bottom-full mb-2 w-[240px] rounded-[14px] border border-[#E2E8F0] bg-white shadow-xl py-1.5 z-20">
          <a role="menuitem" className={item} href={icsHref} download>Download (.ics)</a>
          <a role="menuitem" className={item} href={googleHref} target="_blank" rel="noreferrer">Google Calendar</a>
        </div>
      ) : null}
    </div>
  );
}

/** Step 5: the booking is made (README, Step 5). */
export function ConfirmationStep({
  booking,
  channel,
  mode,
  apiBase,
}: {
  booking: ConfirmedBooking;
  channel: string;
  mode: 'paid' | 'transfer';
  apiBase: string;
}) {
  const payment = mode === 'transfer' ? booking.manualPayment : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!payment) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [payment]);
  const remaining = payment ? new Date(payment.holdExpiresAt).getTime() - now : 0;
  const online = formatOf(channel) === 'Online';

  return (
    <section className="bg-white border border-[#E2E8F0] rounded-[24px] p-5 min-[601px]:p-8 flex flex-col gap-6" style={{ boxShadow: 'var(--desk-shadow-sm)' }}>
      <div className="flex flex-col items-center text-center gap-3">
        <span className="h-[60px] w-[60px] rounded-full inline-flex items-center justify-center" style={{ background: payment ? '#FFF7ED' : '#F0FDF4' }}>
          {payment ? <Clock className="h-7 w-7 text-[#C2410C]" /> : <Check className="h-7 w-7 text-[#16A34A]" />}
        </span>
        <h1 className="text-[23px] min-[1024px]:text-[28px] font-bold tracking-[-0.025em] text-[#0F172A]">
          {payment ? 'Your time is held' : "You're booked"}
        </h1>
        <p className="text-[14px] leading-[1.55] text-[#64748B] max-w-[420px]">
          {payment
            ? `Transfer ${naira(payment.amountKobo)} before the hold ends. The practice will confirm your session once the payment arrives.`
            : 'A confirmation has been sent to your email. We look forward to seeing you.'}
        </p>
      </div>

      {payment ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-[18px] bg-[#FFF7ED] px-4 py-3.5">
            <Eyebrow style={{ color: '#C2410C' }}>Time held for</Eyebrow>
            <div className="mt-1 text-[18px] font-bold text-[#0F172A]" style={MONO}>{countdown(remaining)}</div>
            <div className="mt-2 h-1.5 rounded-full bg-white overflow-hidden">
              <div className="h-full rounded-full bg-[#C2410C]" style={{ width: `${Math.max(0, Math.min(100, (remaining / HOLD_MS) * 100))}%` }} />
            </div>
          </div>
          <BankDetails payment={payment} />
        </div>
      ) : null}

      <div className="rounded-[20px] border border-[#E2E8F0] overflow-hidden">
        {[
          ['When', whenLabel(booking.startsAt)],
          ['Format', formatOf(channel)],
          ['With', booking.therapistName],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center gap-3 px-4 py-[13px] border-t border-[#F1F5F9] first:border-t-0">
            <span className="w-[84px] shrink-0 text-[13.5px] text-[#64748B]">{label}</span>
            <span className="flex-1 text-right text-[14px] font-semibold text-[#0F172A]">{value}</span>
          </div>
        ))}
        <div className="bg-[#F8FAFC] px-4 py-3.5 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/portal"
              className="h-11 px-5 rounded-[14px] text-[14px] font-semibold inline-flex items-center justify-center gap-2"
              style={{ background: 'var(--brand-primary, #0F3A53)', color: '#FFFFFF' }}
            >
              <Check className="h-4 w-4" aria-hidden="true" /> Go to my bookings
            </a>
            <CalendarMenu
              icsHref={`${apiBase}/v1/calendar/bookings/${booking.bookingId}/ical?token=${booking.icalToken ?? ''}`}
              googleHref={googleCalendarUrl(booking)}
            />
          </div>
          <p className="text-[13px] text-[#64748B]">Manage your booking any time: reschedule, cancel, pay or fill in your forms.</p>
          {online ? <p className="text-[13px] text-[#64748B]">Your video link will be emailed and shown in your account.</p> : null}
        </div>
      </div>

      {booking.forms?.length ? (
        <div className="flex flex-col gap-3">
          <Eyebrow>What's next</Eyebrow>
          <p className="text-[14px] leading-[1.55] text-[#475569]">
            Please complete {booking.forms.length === 2 ? 'two short forms' : 'a short form'} before your first session. You can also do them later from the emailed link or your account.
          </p>
          {booking.forms.map((form) => (
            <div key={form.href} className="rounded-[18px] border border-[#E2E8F0] px-4 py-3.5 flex items-center gap-3">
              <span className="h-10 w-10 rounded-[12px] inline-flex items-center justify-center shrink-0" style={{ background: 'var(--brand-fill)', color: 'var(--brand-ink, var(--brand-primary))' }}>
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] font-bold text-[#0F172A]">{form.title}</div>
                <div className="text-[12.5px] text-[#64748B]">{form.kind} · about {form.minutes} min</div>
              </div>
              <a href={form.href} aria-label={`Start ${form.title}`} className="h-11 px-4 rounded-[14px] border border-[#CBD5E1] bg-white text-[14px] font-semibold text-[#0F172A] inline-flex items-center">
                Start
              </a>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
