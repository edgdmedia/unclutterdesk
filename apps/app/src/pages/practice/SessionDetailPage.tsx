import { useEffect, useState } from 'react';
import { JoinButton } from '../../components/video/JoinButton';
import { Link, useParams } from 'react-router-dom';
import { CalendarClock, CalendarRange, CheckCircle2, Download, FileText, Loader2, Repeat, Video } from 'lucide-react';
import { Card, Eyebrow, Page, PageHeader, StatTile, StatusBadge, useToast } from '@unclutterdesk/ui';
import { PaymentChip } from '../../components/booking/PaymentChip';
import { ChangeServiceDialog } from '../../components/booking/ChangeServiceDialog';
import { MoveSessionDialog } from '../../components/booking/MoveSessionDialog';
import { api } from '../../utils/apiClient';
import type { SessionRow } from './SessionsPage';
import { activeDisplayPrefs, formatWhen } from '../../utils/displayFormat';
import { sessionStatus } from '../../utils/sessionStatus';

interface SessionDetail extends SessionRow {
  clientEmail: string;
  clientPhone: string | null;
  videoRoomLink: string | null;
  format?: string;
  location?: { id: string; name: string; city: string } | null;
  note: { id: string; status: 'DRAFT' | 'COMPLETED' } | null;
  internalSummary: string | null;
  clientRecap: string | null;
  clientRecapSentAt: string | null;
  can: { edit: boolean; summary: boolean; markPaid: boolean };
  serviceId?: string | null;
  durationMinutes?: number | null;
  /** After a change to a dearer service: what is still owed, and how it was settled. */
  balanceKobo?: string | null;
  balanceStatus?: 'DUE' | 'PAID' | 'WAIVED' | null;
}

const naira = (kobo: string | null) => (kobo === null ? '—' : `₦${(Number(kobo) / 100).toLocaleString('en-NG')}`);
const longWhen = (iso: string) => formatWhen(iso, 'long');

export function SessionDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const [d, setD] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [internal, setInternal] = useState('');
  const [recap, setRecap] = useState('');
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false);
  const [moving, setMoving] = useState(false);
  // BKG-06: whether the client's default forms are in yet.
  const [forms, setForms] = useState<{ intake: boolean; confidentiality: boolean } | null>(null);

  useEffect(() => {
    api.get<SessionDetail>(`/v1/consult/practice/sessions/${id}`)
      .then((r) => {
        setD(r);
        setInternal(r.internalSummary ?? '');
        setRecap(r.clientRecap ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load this session'));
    api
      .get<Array<{ targetType: string }>>(`/v1/intake/submissions/booking/${id}`)
      .then((subs) =>
        setForms({
          intake: subs.some((x) => x.targetType === 'INTAKE'),
          confidentiality: subs.some((x) => x.targetType === 'CONSENT'),
        }),
      )
      .catch(() => setForms(null));
  }, [id]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      setD(await api.get<SessionDetail>(`/v1/consult/practice/sessions/${id}`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That did not work');
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Page header={<PageHeader title="Session" />}>
        <div role="alert" className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
      </Page>
    );
  }
  if (!d) {
    return (
      <Page header={<PageHeader title="Session" />}>
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[var(--desk-text-muted)]" /></div>
      </Page>
    );
  }

  const area = 'w-full px-3 py-2 rounded-[12px] bg-[var(--desk-surface)] border border-[var(--desk-border)] text-[13px] font-medium text-[var(--desk-text)] outline-none';

  return (
    <Page
      header={
        <PageHeader
          eyebrow="SESSION"
          title={d.client.name}
          actions={
            <>
              {d.videoRoomLink && d.status === 'CONFIRMED' ? (
                <JoinButton
                  startsAt={d.startsAt}
                  endsAt={d.endsAt}
                  to={`/session/${d.id}`}
                  label="Start session"
                  className="h-[40px] px-4 rounded-[12px] bg-[var(--desk-pine-600)] text-white text-[12.5px] font-bold inline-flex items-center gap-2 cursor-pointer"
                  waitingClassName="h-[40px] px-4 rounded-[12px] bg-[var(--desk-border)] text-[var(--desk-text-muted)] text-[12.5px] font-bold inline-flex items-center gap-2 cursor-not-allowed"
                />
              ) : null}
              {d.can.summary && d.status !== 'CANCELLED' && new Date(d.startsAt) <= new Date() && d.note?.status !== 'COMPLETED' ? (
                // After the session the room is closed; the note is written in the client's notes, tied to this session.
                <Link to={`/dashboard/clients/${d.client.id}?tab=notes&booking=${d.id}`} className="h-[40px] px-4 rounded-[12px] bg-[var(--desk-pine-600)] text-white text-[12.5px] font-bold inline-flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4" /> {d.note ? 'Finish note' : 'Write note'}
                </Link>
              ) : null}
              <Link to={`/session/${d.id}/prep`} className="h-[40px] px-4 rounded-[12px] bg-white border border-[var(--desk-pine-200)] text-[var(--desk-text)] text-[12.5px] font-bold inline-flex items-center gap-2 cursor-pointer">
                <FileText className="h-4 w-4" /> Session prep
              </Link>
            </>
          }
          secondaryActions={
            d.can.edit ? (
              <>
                {d.status === 'CONFIRMED' ? (
                  <button type="button" disabled={busy} onClick={() => void act(() => api.patch(`/v1/consult/practice/sessions/${d.id}/status`, { status: 'COMPLETED' }), 'Session completed')} className="h-[40px] px-4 rounded-[12px] bg-white border border-[var(--desk-pine-200)] text-[var(--desk-text)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                    <CheckCircle2 className="h-4 w-4" /> Complete
                  </button>
                ) : null}
                {d.status === 'PENDING_PAYMENT' && d.can.markPaid ? (
                  <button type="button" disabled={busy} onClick={() => void act(() => api.post(`/v1/consult/bookings/${d.id}/mark-paid`, {}), 'Payment recorded')} className="h-[40px] px-4 rounded-[12px] bg-white border border-[var(--desk-pine-200)] text-[var(--desk-text)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                    <Download className="h-4 w-4" /> Mark as paid
                  </button>
                ) : null}
                {d.status !== 'CANCELLED' && d.status !== 'COMPLETED' ? (
                  <button type="button" disabled={busy} onClick={() => setMoving(true)} className="h-[40px] px-4 rounded-[12px] bg-white border border-[var(--desk-pine-200)] text-[var(--desk-text)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                    <CalendarRange className="h-4 w-4" /> Move session
                  </button>
                ) : null}
                {d.status !== 'CANCELLED' ? (
                  <button type="button" disabled={busy} onClick={() => setChanging(true)} className="h-[40px] px-4 rounded-[12px] bg-white border border-[var(--desk-pine-200)] text-[var(--desk-text)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                    <Repeat className="h-4 w-4" /> Change service
                  </button>
                ) : null}
                {d.status !== 'CANCELLED' && d.status !== 'COMPLETED' ? (
                  <button type="button" disabled={busy} onClick={() => void act(() => api.patch(`/v1/consult/practice/sessions/${d.id}/status`, { status: 'CANCELLED' }), 'Session cancelled — the time is open again')} className="h-[40px] px-4 rounded-[12px] bg-white border border-rose-200 text-rose-600 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                    Cancel session
                  </button>
                ) : null}
              </>
            ) : null
          }
        />
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        {(() => { const st = sessionStatus(d.status, d.startsAt, d.endsAt, new Date(), activeDisplayPrefs().timezone); return <StatusBadge status={st.label} tone={st.tone} />; })()}
        <PaymentChip status={d.status} paymentMethod={d.paymentMethod} holdExpiresAt={d.holdExpiresAt} />
        {d.bookedBy ? <span className="text-[11.5px] text-[var(--desk-text-muted)]">Booked by {d.bookedBy}</span> : null}
      </div>

      <Card padding="p-[22px]" className="space-y-4">
        <Eyebrow>THE SESSION</Eyebrow>
        <div className="grid grid-cols-1 @min-[640px]/page:grid-cols-2 gap-3">
          <StatTile variant="inset" size="sm" label="WHEN" value={longWhen(d.startsAt)} />
          <StatTile variant="inset" size="sm" label="SERVICE" value={d.serviceTitle} />
          <StatTile variant="inset" size="sm" label="PRACTITIONER" value={d.provider.name} />
          <StatTile variant="inset" size="sm" label="PAID" value={`${d.paymentMethod === 'NONE' ? 'No charge' : naira(d.amountKobo)}`} />
          <StatTile variant="inset" size="sm" label="FORMAT" value={d.format === 'IN_PERSON' && d.location ? `In person · ${d.location.name}` : d.format === 'IN_PERSON' ? 'In person' : 'Online'} />
        </div>
        <p className="text-[12.5px] text-[var(--desk-text-muted)]">
          {d.clientEmail}{d.clientPhone ? ` · ${d.clientPhone}` : ''}
          {' · '}
          <Link to={`/dashboard/clients/${d.client.id}`} className="font-bold text-[var(--desk-pine-600)] underline">Client file</Link>
        </p>
        {d.note ? (
          <p className="text-[12.5px] font-medium text-[var(--desk-text-body)] inline-flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4" /> Note {d.note.status === 'COMPLETED' ? 'signed' : 'in draft'}
          </p>
        ) : null}
        {forms ? (
          <p className="text-[12.5px] font-medium text-[var(--desk-text-body)] inline-flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>Intake: {forms.intake ? 'done' : 'waiting'}</span>
            <span aria-hidden="true">·</span>
            <span>Confidentiality: {forms.confidentiality ? 'done' : 'waiting'}</span>
          </p>
        ) : null}
      </Card>

      {d.balanceStatus === 'DUE' && d.balanceKobo ? (
        <Card padding="p-[22px]" className="space-y-3 border-[var(--desk-pending-border)] bg-[var(--desk-pending-bg)]">
          <Eyebrow>BALANCE</Eyebrow>
          <p className="text-[13.5px] text-[var(--desk-text)]">
            <span className="font-bold">{naira(d.balanceKobo)}</span> is still owed: the session was changed to a dearer service after the client paid.
          </p>
          {d.can.markPaid ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void act(() => api.post(`/v1/consult/practice/sessions/${d.id}/balance`, { action: 'PAID' }), 'Balance recorded as paid')} className="h-[38px] px-4 rounded-[12px] bg-[var(--desk-pine-600)] text-white text-[12.5px] font-bold cursor-pointer disabled:opacity-50">
                Paid at the practice
              </button>
              <button type="button" disabled={busy} onClick={() => void act(() => api.post(`/v1/consult/practice/sessions/${d.id}/balance`, { action: 'WAIVED' }), 'Balance waived')} className="h-[38px] px-4 rounded-[12px] bg-white border border-[var(--desk-pine-200)] text-[var(--desk-text)] text-[12.5px] font-bold cursor-pointer disabled:opacity-50">
                Waive
              </button>
            </div>
          ) : (
            <p className="text-[12px] text-[var(--desk-text-muted)]">The front desk records it as paid, or waives it.</p>
          )}
        </Card>
      ) : d.balanceStatus === 'WAIVED' && d.balanceKobo ? (
        <p className="text-[12.5px] text-[var(--desk-text-muted)]">A balance of {naira(d.balanceKobo)} was waived.</p>
      ) : null}

      {changing ? (
        <ChangeServiceDialog
          session={d}
          onClose={() => setChanging(false)}
          onChanged={(r) => {
            setChanging(false);
            const owed = r.balanceKobo ? ` ${naira(r.balanceKobo)} is still owed.` : '';
            const over = r.overpaidKobo !== '0' ? ` The client paid ${naira(r.overpaidKobo)} more than the new price.` : '';
            toast.success(`Now ${r.serviceTitle}.${owed}${over}`);
            void api.get<SessionDetail>(`/v1/consult/practice/sessions/${id}`).then(setD).catch(() => undefined);
          }}
        />
      ) : null}

      {moving ? (
        <MoveSessionDialog
          session={d}
          onClose={() => setMoving(false)}
          onMoved={(r) => {
            setMoving(false);
            toast.success(`Session moved to ${longWhen(r.startsAt)}. The client has been emailed.`);
            void api.get<SessionDetail>(`/v1/consult/practice/sessions/${id}`).then(setD).catch(() => undefined);
          }}
        />
      ) : null}

      {d.can.summary ? (
        <Card padding="p-[22px]" className="space-y-3">
          <Eyebrow>SUMMARY</Eyebrow>
          <label className="block text-[11.5px] font-bold text-slate-500 uppercase">
            Internal summary (staff only)
            <textarea rows={3} className={area} value={internal} onChange={(e) => setInternal(e.target.value)} placeholder="What happened, for the file." />
          </label>
          <label className="block text-[11.5px] font-bold text-slate-500 uppercase">
            Client recap
            <textarea rows={3} className={area} value={recap} onChange={(e) => setRecap(e.target.value)} placeholder="Written for the client: what was covered, what to practise." />
          </label>
          {d.clientRecapSentAt ? (
            <p className="text-[11.5px] text-emerald-700 font-semibold">Recap sent {new Date(d.clientRecapSentAt).toLocaleDateString('en-GB')}.</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(() => api.patch(`/v1/consult/practice/sessions/${d.id}/summary`, { internalSummary: internal, clientRecap: recap }), 'Summary saved')}
              className="h-[38px] px-4 rounded-[12px] bg-[var(--desk-pine-600)] text-white text-[12.5px] font-bold cursor-pointer disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              disabled={busy || !recap.trim()}
              onClick={() => void act(() => api.post(`/v1/consult/practice/sessions/${d.id}/recap-email`, {}), 'Recap emailed to the client')}
              className="h-[38px] px-4 rounded-[12px] bg-white border border-[var(--desk-pine-200)] text-[var(--desk-text)] text-[12.5px] font-bold cursor-pointer disabled:opacity-50"
            >
              Send recap
            </button>
          </div>
        </Card>
      ) : null}
    </Page>
  );
}
