import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Calendar, Check } from 'lucide-react';
import { useBrand } from '@unclutterdesk/ui';
import { api, getBookingUrl, TENANT_SLUG } from '../utils/apiClient';
import { RescheduleDialog } from '../components/RescheduleDialog';
import { initialsOf } from '../utils/initials';
import { useAuth } from '../context/AuthContext';

type PortalTab = 'upcoming' | 'past' | 'payments' | 'settings';

type PortalSession = {
  icalToken?: string;
  id: string;
  serviceTitle: string;
  startsAt: string;
  endsAt: string;
  status: string;
  priceKobo: string;
  therapistName: string;
  videoRoomLink: string | null;
};

type PortalPayload = {
  clientName: string;
  upcoming: PortalSession[];
  past: PortalSession[];
};

type Payment = {
  bookingId: string;
  serviceTitle: string;
  sessionAt: string;
  amountKobo: string;
  discountCode: string | null;
  status: string;
  paidAt: string | null;
  reference: string | null;
  bookedAt: string;
};

type PaymentsPayload = {
  payments: Payment[];
  totalPaidKobo: string;
  outstandingKobo: string;
};

const PAYMENT_STATES: Record<string, { label: string; cls: string }> = {
  PAID: { label: 'Paid', cls: 'bg-[#ECFDF5] text-[#059669]' },
  PENDING_PAYMENT: { label: 'Awaiting payment', cls: 'bg-[#FFFBEB] text-[#B45309]' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-[#F1F5F9] text-[#64748B]' },
  FREE: { label: 'No charge', cls: 'bg-[#F1F5F9] text-[#64748B]' },
};

/**
 * A booking's status is about the appointment, not the money, so the two only
 * partly overlap: a CONFIRMED session may be paid or may simply have been free.
 * paidAt is the only thing that actually says money changed hands.
 */
function paymentState(payment: Payment): { label: string; cls: string } {
  if (payment.status === 'CANCELLED') return PAYMENT_STATES.CANCELLED;
  if (payment.paidAt) return PAYMENT_STATES.PAID;
  if (payment.status === 'PENDING_PAYMENT') return PAYMENT_STATES.PENDING_PAYMENT;
  return PAYMENT_STATES.FREE;
}

function formatDay(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function formatMoney(priceKobo: string) {
  return `₦${(Number(priceKobo) / 100).toLocaleString('en-NG')}`;
}

function formatDateParts(startsAt: string) {
  const date = new Date(startsAt);
  return {
    day: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date).toUpperCase(),
    date: new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date).toUpperCase(),
  };
}

function formatTimeRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return `${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(start)} — ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(end)}`;
}

function DateTile({ startsAt, size = 'md' }: { startsAt: string; size?: 'md' | 'lg' }) {
  const parts = formatDateParts(startsAt);
  const cls = size === 'lg' ? 'w-[86px] rounded-[20px] py-[14px]' : 'w-[54px] rounded-[16px] py-[9px]';
  return (
    <div className={`${cls} flex-none text-center bg-[rgba(255,255,255,0.1)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]`}>
      <div className="text-[9.5px] font-black tracking-[0.1em] uppercase text-[#E3B341]">{parts.day}</div>
      <div className={`${size === 'lg' ? 'text-[30px]' : 'text-[19px]'} font-extrabold leading-none text-white`}>{parts.date}</div>
      <div className="mt-0.5 text-[10.5px] font-black tracking-[0.08em] uppercase text-[#E3B341]">{parts.month}</div>
    </div>
  );
}

export function ClientPortalPage() {
  const brand = useBrand();
  const { profile, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const primary = brand.primaryColor || '#0F3A53';

  const [tab, setTab] = useState<PortalTab>('upcoming');
  const [lookupEmail, setLookupEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasReviewForm, setHasReviewForm] = useState(false);
  const [portal, setPortal] = useState<PortalPayload>({ clientName: '', upcoming: [], past: [] });
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentsPayload | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReviewAvailability() {
      try {
        const forms = await api.get<Array<{ id: string }>>('/v1/intake/public/forms?targetType=REVIEW');
        if (!cancelled) setHasReviewForm(forms.length > 0);
      } catch {
        if (!cancelled) setHasReviewForm(false);
      }
    }

    void loadReviewAvailability();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && profile?.email) {
      setLookupEmail(profile.email);
      void loadPortal();
    }
  }, [isAuthenticated, profile?.email]);

  // The server identifies the client from the session. It used to accept any
  // email in the query string, which meant anyone could read anyone's sessions.
  async function loadPortal() {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.get<PortalPayload>('/v1/consult/portal');
      setPortal(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load portal');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== 'payments' || !isAuthenticated || payments) return;
    let cancelled = false;
    api
      .get<PaymentsPayload>('/v1/consult/portal/payments')
      .then((data) => {
        if (!cancelled) setPayments(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setPaymentsError(
            err instanceof Error ? err.message : 'Unable to load your payment history',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab, isAuthenticated, payments]);

  const nextSession = portal.upcoming[0] || null;

  // A session already paid for or awaiting payment can still be moved; a
  // cancelled one cannot, and the server refuses one inside the practice's
  // notice period — which is why the button opens the dialog rather than
  // deciding here whether the move is allowed.
  const canReschedule = (session: PortalSession) => session.status !== 'CANCELLED';
  const initials = initialsOf(portal.clientName, 'CL');

  const tabs: Array<{ key: PortalTab; label: string }> = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past sessions' },
    { key: 'payments', label: 'Payments' },
    { key: 'settings', label: 'Preferences' },
  ];

  return (
    <div className="min-h-screen bg-[#F6F8FA] text-[#0F172A] font-outfit flex flex-col">
      <header className="h-[72px] shrink-0 flex items-center px-8 gap-3" style={{ backgroundColor: primary }}>
        <div className="h-[34px] w-[34px] rounded-[11px] bg-[#E3B341] text-[#0F172A] font-extrabold text-[13px] flex items-center justify-center">
          {initialsOf(brand.name, 'UD')}
        </div>
        <span className="text-[16.5px] font-semibold text-white">{brand.name}</span>
        <div className="ml-auto flex items-center gap-4">
          <div className="h-[34px] w-[34px] rounded-full bg-white/15 text-white text-[12px] font-extrabold flex items-center justify-center">
            {initials}
          </div>
          <span className="text-[13.5px] font-semibold text-white">{portal.clientName || 'Client portal'}</span>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-[1080px] mx-auto p-[30px_34px_40px] flex flex-col gap-5">
          <div>
            <span className="text-[9px] font-black tracking-[0.22em] uppercase text-[#94A3B8] block">YOUR SESSIONS</span>
            <h1 className="mt-1 text-[28px] font-bold tracking-[-0.03em] text-[#0F172A]">{portal.clientName ? `Hello, ${portal.clientName.split(' ')[0]}` : 'Client portal'}</h1>
          </div>

          {portal.upcoming.some(s => s.status === 'PENDING_PAYMENT') && (
            <div className="rounded-[18px] border border-amber-200 bg-amber-50 p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[14.5px] font-bold text-amber-900">You have an incomplete booking</h3>
                  <p className="text-[13px] text-amber-700 mt-0.5">Please complete your payment within 30 minutes to secure your slot.</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  const pending = portal.upcoming.find(s => s.status === 'PENDING_PAYMENT');
                  if (!pending) return;

                  if (!isAuthenticated || profile?.type !== 'user') {
                    navigate('/login', {
                      state: {
                        email: lookupEmail,
                        returnTo: '/portal',
                      },
                    });
                    return;
                  }

                  try {
                    const res = await api.post<{ paymentUrl: string }>(`/v1/consult/public/bookings/${pending.id}/pay`, { email: lookupEmail });
                    if (res.paymentUrl) window.location.href = res.paymentUrl;
                  } catch (e: any) {
                    alert('Failed to get payment URL: ' + e.message);
                  }
                }}
                className="px-5 h-[38px] rounded-[10px] bg-amber-500 text-white text-[13px] font-bold shadow-[0_4px_12px_rgba(245,158,11,0.3)] hover:bg-amber-600 cursor-pointer transition-colors"
              >
                Pay now →
              </button>
            </div>
          )}

          {!isAuthenticated ? (
            <div className="rounded-[22px] bg-white border border-[#E2E8F0] p-5 space-y-3">
              <div className="space-y-1">
                <h3 className="text-[15px] font-bold text-[#0F172A]">Sign in to see your sessions</h3>
                <p className="text-[13px] text-[#64748B] leading-relaxed">
                  Use the email address you booked with. Your sessions and join links
                  are private, so they are only shown once you are signed in.
                </p>
              </div>
              <a
                href="/login"
                className="inline-flex h-[46px] px-5 rounded-[14px] text-white text-[13px] font-bold items-center"
                style={{ backgroundColor: primary }}
              >
                Sign in
              </a>
            </div>
          ) : null}

          {notice ? <div role="status" className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{notice}</div> : null}

          {error ? <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}

          {loading ? (
            <div className="rounded-[24px] border border-[#E2E8F0] bg-white px-6 py-10 text-sm font-medium text-[#64748B]">Loading your sessions...</div>
          ) : nextSession ? (
            <div className="rounded-[24px] p-[26px_28px] flex items-center gap-6 shadow-[0_14px_40px_rgba(15,58,83,0.22)]" style={{ background: `linear-gradient(135deg,${primary},#1B5375)` }}>
              <DateTile startsAt={nextSession.startsAt} size="lg" />
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-black tracking-[0.22em] uppercase text-[#E3B341] block">YOUR NEXT SESSION</span>
                <h2 className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-white">{formatTimeRange(nextSession.startsAt, nextSession.endsAt)}</h2>
                <p className="mt-1 text-[13.5px] font-medium text-[#CBD5E1]">{nextSession.serviceTitle} · with {nextSession.therapistName}</p>
              </div>
              <div className="flex gap-3 shrink-0">
                <a 
                  href={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/v1/calendar/bookings/${nextSession.id}/ical?token=${nextSession.icalToken ?? ''}`}
                  download
                  className="h-[48px] px-5 rounded-[16px] bg-transparent border border-[rgba(255,255,255,0.22)] text-white text-[13.5px] font-bold flex items-center gap-2 hover:bg-white/10 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Add to Calendar
                </a>
                {canReschedule(nextSession) ? (
                  <button
                    type="button"
                    onClick={() => setReschedulingId(nextSession.id)}
                    className="h-[48px] px-5 rounded-[16px] bg-transparent border border-[rgba(255,255,255,0.22)] text-white text-[13.5px] font-bold flex items-center gap-2 hover:bg-white/10 cursor-pointer"
                  >
                    Reschedule
                  </button>
                ) : null}
                {nextSession.videoRoomLink ? (
                  <a href={nextSession.videoRoomLink} target="_blank" rel="noreferrer" className="h-[48px] px-5 rounded-[16px] bg-[#E3B341] text-[#0F172A] text-[13.5px] font-extrabold flex items-center gap-2 shadow-[0_8px_22px_rgba(227,179,65,0.35)] hover:brightness-105 cursor-pointer">
                    <Video className="h-4 w-4" />
                    Join session
                  </a>
                ) : (
                  <button className="h-[48px] px-5 rounded-[16px] bg-[#E2E8F0] text-[#64748B] text-[13.5px] font-extrabold flex items-center gap-2 cursor-not-allowed">
                    <Video className="h-4 w-4" />
                    No room link yet
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-white px-6 py-10 text-sm font-medium text-[#64748B]">
              No upcoming sessions found for {lookupEmail}.
            </div>
          )}

          <div className="flex gap-1.5 p-[5px] bg-[#EEF2F7] rounded-[12px] w-fit">
            {tabs.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`h-[36px] px-4 rounded-[10px] text-[12.5px] font-bold transition-all cursor-pointer ${
                  tab === item.key ? 'bg-white text-[#0F172A] shadow-[0_2px_8px_rgba(15,23,42,0.1)]' : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'upcoming' && (
            <div className="bg-white rounded-[22px] border border-[#E2E8F0] overflow-hidden">
              {portal.upcoming.length === 0 ? (
                <div className="px-5 py-10 text-sm font-medium text-[#64748B]">No upcoming sessions.</div>
              ) : (
                portal.upcoming.map((session, index) => (
                  <div key={session.id} className={`flex items-center gap-4 px-5 py-[16px] ${index > 0 ? 'border-t border-[#F1F5F9]' : ''}`}>
                    <DateTile startsAt={session.startsAt} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold text-[#0F172A]">{session.serviceTitle}</div>
                      <div className="text-[12px] text-[#64748B] font-medium">{formatTimeRange(session.startsAt, session.endsAt)} · with {session.therapistName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13.5px] font-extrabold text-[#0F172A]">{formatMoney(session.priceKobo)}</div>
                      <div className="text-[11px] text-[#94A3B8] font-medium">{session.status}</div>
                    </div>
                    {canReschedule(session) ? (
                      <button
                        type="button"
                        onClick={() => setReschedulingId(session.id)}
                        className="h-[34px] px-3 rounded-[10px] border border-[#E2E8F0] text-[12px] font-bold text-[#475569] hover:bg-[#F8FAFC] cursor-pointer"
                      >
                        Reschedule
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'past' && (
            <div className="bg-white rounded-[22px] border border-[#E2E8F0] overflow-hidden">
              {portal.past.length === 0 ? (
                <div className="px-5 py-10 text-sm font-medium text-[#64748B]">No completed or past sessions yet.</div>
              ) : (
                portal.past.map((session, index) => (
                  <div key={session.id} className={`flex items-center gap-4 px-5 py-[16px] ${index > 0 ? 'border-t border-[#F1F5F9]' : ''}`}>
                    <DateTile startsAt={session.startsAt} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold text-[#0F172A]">{session.serviceTitle}</div>
                      <div className="text-[12px] text-[#64748B] font-medium">{formatTimeRange(session.startsAt, session.endsAt)} · with {session.therapistName}</div>
                    </div>
                    <span className="h-[22px] px-2.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[9.5px] font-black tracking-[0.06em] uppercase flex items-center gap-1">
                      <Check className="h-3 w-3" strokeWidth={3} />
                      {session.status}
                    </span>
                    {hasReviewForm && TENANT_SLUG && session.status === 'COMPLETED' ? (
                      <a
                        href={`${getBookingUrl(TENANT_SLUG)}/review`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[12.5px] font-bold text-[#0F3A53] hover:underline cursor-pointer"
                      >
                        Leave review
                      </a>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          )}


          {tab === 'payments' && (
            <div className="flex flex-col gap-4">
              {paymentsError ? (
                <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {paymentsError}
                </div>
              ) : !payments ? (
                <div className="rounded-[22px] border border-[#E2E8F0] bg-white px-5 py-10 text-sm font-medium text-[#64748B]">
                  Loading your payments...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-[18px_20px]">
                      <div className="text-[9px] font-black tracking-[0.18em] uppercase text-[#94A3B8]">
                        TOTAL PAID
                      </div>
                      <div className="mt-1.5 text-[24px] font-bold tracking-[-0.02em] text-[#0F172A]">
                        {formatMoney(payments.totalPaidKobo)}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-[18px_20px]">
                      <div className="text-[9px] font-black tracking-[0.18em] uppercase text-[#94A3B8]">
                        OUTSTANDING
                      </div>
                      <div
                        className={`mt-1.5 text-[24px] font-bold tracking-[-0.02em] ${
                          payments.outstandingKobo === '0' ? 'text-[#0F172A]' : 'text-[#B45309]'
                        }`}
                      >
                        {formatMoney(payments.outstandingKobo)}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-[22px] border border-[#E2E8F0] overflow-hidden">
                    {payments.payments.length === 0 ? (
                      <div className="px-5 py-10 text-sm font-medium text-[#64748B]">
                        No payments yet. Anything you are charged will show up here.
                      </div>
                    ) : (
                      payments.payments.map((payment, index) => {
                        const state = paymentState(payment);
                        return (
                          <div
                            key={payment.bookingId}
                            className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-[16px] ${index > 0 ? 'border-t border-[#F1F5F9]' : ''}`}
                          >
                            <div className="flex-1 min-w-[180px]">
                              <div className="text-[14px] font-bold text-[#0F172A]">
                                {payment.serviceTitle}
                              </div>
                              <div className="text-[12px] text-[#64748B] font-medium">
                                Session {formatDay(payment.sessionAt)}
                                {payment.discountCode ? ` · ${payment.discountCode} applied` : ''}
                              </div>
                              {payment.reference ? (
                                <div className="text-[10.5px] text-[#94A3B8] font-medium mt-0.5 break-all">
                                  Ref {payment.reference}
                                </div>
                              ) : null}
                            </div>
                            <span
                              className={`h-[22px] px-2.5 rounded-full text-[9.5px] font-black tracking-[0.06em] uppercase flex items-center ${state.cls}`}
                            >
                              {state.label}
                            </span>
                            <div className="text-right min-w-[92px]">
                              <div className="text-[13.5px] font-extrabold text-[#0F172A]">
                                {formatMoney(payment.amountKobo)}
                              </div>
                              <div className="text-[11px] text-[#94A3B8] font-medium">
                                {payment.paidAt ? formatDay(payment.paidAt) : '—'}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <p className="text-[11.5px] text-[#94A3B8] leading-[1.6]">
                    Amounts are what you were charged at the time of booking. For a formal receipt,
                    contact the practice.
                  </p>
                </>
              )}
            </div>
          )}

          {tab === 'settings' && (
            <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
              <div className="text-[12px] font-black tracking-[0.1em] uppercase text-[#94A3B8] mb-1">PREFERENCES</div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Currency</label>
                  <select className="h-[46px] w-full px-[14px] rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-medium text-[#0F172A] outline-none" disabled value="NGN">
                    <option value="NGN">NGN - Nigerian Naira</option>
                  </select>
                  <p className="text-[10.5px] text-[#94A3B8] mt-1.5 font-medium">Platform default.</p>
                </div>
                <div>
                  <label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Date & Time Format</label>
                  <select className="h-[46px] w-full px-[14px] rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-medium text-[#0F172A] outline-none" disabled value="en-GB">
                    <option value="en-GB">DD/MM/YYYY, 12-hour</option>
                  </select>
                  <p className="text-[10.5px] text-[#94A3B8] mt-1.5 font-medium">Platform default.</p>
                </div>
                <div>
                  <label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Language</label>
                  <select className="h-[46px] w-full px-[14px] rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-medium text-[#0F172A] outline-none" disabled value="en">
                    <option value="en">English (UK)</option>
                  </select>
                  <p className="text-[10.5px] text-[#94A3B8] mt-1.5 font-medium">More languages coming soon.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {reschedulingId ? (
        <RescheduleDialog
          bookingId={reschedulingId}
          primaryColor={primary}
          onClose={() => setReschedulingId(null)}
          onRescheduled={() => {
            setReschedulingId(null);
            setNotice('Your session has been moved. The new time is below.');
            // The payment rows carry the session date, so they are stale now.
            setPayments(null);
            // Re-read rather than patching local state: the move also frees the
            // old slot and can change what else is bookable.
            void loadPortal();
          }}
        />
      ) : null}
    </div>
  );
}
