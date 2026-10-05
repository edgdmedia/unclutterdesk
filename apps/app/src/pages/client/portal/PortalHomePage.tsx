import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronRight, ClipboardList } from 'lucide-react';
import { Card, Grid, MetricTile, Page, PageHeader, useBrand, useToast } from '@unclutterdesk/ui';
import { api, API_BASE } from '../../../utils/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { RescheduleDialog } from '../../../components/RescheduleDialog';
import { JoinButton } from '../../../components/video/JoinButton';
import { TransferDetails } from '../../../components/payments/TransferDetails';
import { usePortalData, type PortalSession } from './PortalDataContext';
import { formatDay, formatTimeRange } from './portalFormat';
import { DateTile } from './DateTile';
import { BookSessionButton } from './BookSessionButton';

/** POR-03: the portal's front page — greeting, tiles, next session, what is due. */
export function PortalHomePage() {
  const toast = useToast();
  const brand = useBrand();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const primary = brand.primaryColor || '#0F3A53';
  const { portal, loading, error, reload, formsTodo, waitingAssessments, markPaymentsStale } = usePortalData();
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const firstName = portal.clientName ? portal.clientName.split(' ')[0] : (profile?.firstName ?? 'there');
  const nextSession = portal.upcoming[0] || null;
  const comingUp = portal.upcoming.slice(1, 4);
  // A session already paid for or awaiting payment can still be moved; a
  // cancelled one cannot, and the server refuses one inside the practice's
  // notice period — which is why the button opens the dialog rather than
  // deciding here whether the move is allowed.
  const canReschedule = (session: PortalSession) => session.status !== 'CANCELLED';

  return (
    <>
      <Page
        layout="main-aside"
        header={<PageHeader eyebrow={brand.name} title={`Hello, ${firstName}`} actions={<BookSessionButton />} />}
        aside={
          <>
            {comingUp.length ? (
              <Card padding="p-5" className="space-y-2">
                <span className="text-[9px] font-black tracking-[0.22em] uppercase text-[#94A3B8] block">COMING UP</span>
                {comingUp.map((s) => (
                  <button key={s.id} type="button" onClick={() => navigate('/portal/sessions')} className="w-full flex items-center gap-3 py-2 border-t border-[#F1F5F9] first:border-t-0 text-left cursor-pointer">
                    <DateTile startsAt={s.startsAt} />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-bold text-[#0F172A] truncate">{s.serviceTitle}</span>
                      <span className="block text-[12px] text-[#64748B]">{formatTimeRange(s.startsAt, s.endsAt)}</span>
                    </span>
                  </button>
                ))}
              </Card>
            ) : null}
            {formsTodo && formsTodo > 0 ? (
              <Card padding="p-5">
                <button type="button" onClick={() => navigate('/portal/forms')} className="w-full text-left flex items-center gap-3 cursor-pointer">
                  <span className="h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0" style={{ backgroundColor: primary }}><ClipboardList className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-bold text-[#0F172A]">{formsTodo} {formsTodo === 1 ? 'form' : 'forms'} to do</span>
                    <span className="block text-[12px] text-[#64748B]">Your practitioner is waiting for them.</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: primary }} aria-hidden="true" />
                </button>
              </Card>
            ) : null}
          </>
        }
      >
        {portal.upcoming
          .filter((s) => s.status === 'PENDING_PAYMENT' && s.manualPayment)
          .map((s) => (
            <div key={s.id} className="space-y-2">
              <p className="text-[13px] font-semibold text-[#475569]">
                {s.serviceTitle} on {formatDay(s.startsAt)} with {s.therapistName}
              </p>
              <TransferDetails payment={s.manualPayment!} bookingId={s.id} email={profile?.email ?? ''} color={primary} />
            </div>
          ))}

        {portal.upcoming.some((s) => s.status === 'PENDING_PAYMENT' && !s.manualPayment) && (
          <div className="rounded-[18px] border border-amber-200 bg-amber-50 p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-[14.5px] font-bold text-amber-900">You have an incomplete booking</h3>
                <p className="text-[13px] text-amber-700 mt-0.5">Please complete your payment within 30 minutes to secure your slot.</p>
              </div>
            </div>
            <button
              onClick={async () => {
                const pending = portal.upcoming.find((s) => s.status === 'PENDING_PAYMENT' && !s.manualPayment);
                if (!pending) return;
                try {
                  const res = await api.post<{ paymentUrl: string }>(`/v1/consult/public/bookings/${pending.id}/pay`, { email: profile?.email });
                  if (res.paymentUrl) window.location.href = res.paymentUrl;
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Could not open payment. Please try again.');
                }
              }}
              className="px-5 h-[38px] rounded-[10px] bg-amber-500 text-white text-[13px] font-bold shadow-[0_4px_12px_rgba(245,158,11,0.3)] hover:bg-amber-600 cursor-pointer transition-colors"
            >
              Pay now →
            </button>
          </div>
        )}

        {notice ? <div role="status" className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{notice}</div> : null}
        {error ? <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}

        <Grid cols={{ base: 2, lg: 4 }}>
          <MetricTile value={nextSession ? formatDay(nextSession.startsAt) : 'None'} label="Next session" />
          <MetricTile value={String(portal.upcoming.filter((x) => x.status !== 'CANCELLED').length)} label="Upcoming sessions" />
          <MetricTile
            value={`₦${(portal.upcoming.filter((x) => x.status === 'PENDING_PAYMENT').reduce((sum, x) => sum + Number(x.priceKobo || 0), 0) / 100).toLocaleString('en-NG')}`}
            label="To pay"
          />
          <MetricTile value={formsTodo === null ? '—' : String(formsTodo)} label="Forms to do" />
        </Grid>

        {loading ? (
          <div className="rounded-[24px] border border-[#E2E8F0] bg-white px-6 py-10 text-sm font-medium text-[#64748B]">Loading your sessions...</div>
        ) : nextSession ? (
          <div className="rounded-[24px] p-[26px_28px] flex items-center gap-6 shadow-[0_14px_40px_rgba(15,58,83,0.22)] flex-wrap" style={{ background: `linear-gradient(135deg,${primary},#1B5375)` }}>
            <DateTile startsAt={nextSession.startsAt} size="lg" />
            <div className="flex-1 min-w-0">
              <span className="text-[9px] font-black tracking-[0.22em] uppercase text-[#E3B341] block">YOUR NEXT SESSION</span>
              <h2 className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-white">{formatTimeRange(nextSession.startsAt, nextSession.endsAt)}</h2>
              <p className="mt-1 text-[13.5px] font-medium text-[#CBD5E1]">{nextSession.serviceTitle} · with {nextSession.therapistName}</p>
            </div>
            <div className="flex gap-3 shrink-0 flex-wrap w-full sm:w-auto justify-start">
              <a
                href={`${API_BASE}/v1/calendar/bookings/${nextSession.id}/ical?token=${nextSession.icalToken ?? ''}`}
                download
                className="h-[48px] px-5 rounded-[16px] bg-transparent border border-[rgba(255,255,255,0.22)] text-white text-[13.5px] font-bold flex items-center gap-2 hover:bg-white/10 cursor-pointer"
              >
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
              {nextSession.status === 'CONFIRMED' && nextSession.format !== 'IN_PERSON' ? (
                <JoinButton startsAt={nextSession.startsAt} endsAt={nextSession.endsAt} to={`/portal/sessions/${nextSession.id}/room`} />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-[#E2E8F0] bg-white px-6 py-10 flex flex-col items-start gap-4">
            <p className="text-[15px] font-bold text-[#0F172A]">You have no sessions booked yet</p>
            <p className="text-[13.5px] text-[#64748B] -mt-2">Choose a time that suits you; payment, where it applies, is handled while you book.</p>
            <BookSessionButton label="Book your first session" />
          </div>
        )}

        {waitingAssessments.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => navigate(`/portal/assessments/${a.id}`)}
            className="text-left rounded-[18px] border border-[#E2E8F0] bg-white p-4 flex items-center gap-3 shadow-sm hover:border-[#CBD5E1] cursor-pointer w-full"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0" style={{ backgroundColor: primary }}>
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[14.5px] font-bold text-[#0F172A]">Your practitioner sent you {a.shortName}</h3>
              <p className="text-[13px] text-[#64748B] mt-0.5 truncate">
                {a.message ? `“${a.message}”` : `${a.measures} · about ${a.estimatedMinutes} minutes`}
              </p>
            </div>
            <span className="text-[12.5px] font-bold shrink-0 flex items-center gap-1" style={{ color: primary }}>
              Start <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        ))}
      </Page>

      {reschedulingId ? (
        <RescheduleDialog
          bookingId={reschedulingId}
          primaryColor={primary}
          onClose={() => setReschedulingId(null)}
          onRescheduled={() => {
            setReschedulingId(null);
            setNotice('Your session has been moved. The new time is below.');
            // The payment rows carry the session date, so they are stale now.
            markPaymentsStale();
            // Re-read rather than patching local state: the move also frees the
            // old slot and can change what else is bookable.
            void reload();
          }}
        />
      ) : null}
    </>
  );
}
