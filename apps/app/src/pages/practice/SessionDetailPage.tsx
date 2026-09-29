import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Download, FileText, Loader2, Video } from 'lucide-react';
import { Card, Eyebrow, Page, PageHeader, StatTile, StatusBadge, useToast } from '@unclutterdesk/ui';
import { PaymentChip } from '../../components/booking/PaymentChip';
import { api } from '../../utils/apiClient';
import type { SessionRow } from './SessionsPage';

interface SessionDetail extends SessionRow {
  clientEmail: string;
  clientPhone: string | null;
  videoRoomLink: string | null;
  note: { id: string; status: 'DRAFT' | 'COMPLETED' } | null;
  internalSummary: string | null;
  clientRecap: string | null;
  clientRecapSentAt: string | null;
  can: { edit: boolean; summary: boolean; markPaid: boolean };
}

const naira = (kobo: string | null) => (kobo === null ? '—' : `₦${(Number(kobo) / 100).toLocaleString('en-NG')}`);
const longWhen = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export function SessionDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const [d, setD] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [internal, setInternal] = useState('');
  const [recap, setRecap] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<SessionDetail>(`/v1/consult/practice/sessions/${id}`)
      .then((r) => {
        setD(r);
        setInternal(r.internalSummary ?? '');
        setRecap(r.clientRecap ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load this session'));
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
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#64748B]" /></div>
      </Page>
    );
  }

  const area = 'w-full px-3 py-2 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-medium text-[#0F172A] outline-none';

  return (
    <Page
      header={
        <PageHeader
          eyebrow="SESSION"
          title={d.client.name}
          actions={
            <>
              {d.channel === 'VIDEO' && d.videoRoomLink ? (
                <Link to={`/session/${d.id}`} className="h-[40px] px-4 rounded-[12px] bg-[#0F3A53] text-white text-[12.5px] font-bold inline-flex items-center gap-2 cursor-pointer">
                  <Video className="h-4 w-4" /> Start session
                </Link>
              ) : null}
              <Link to={`/session/${d.id}/prep`} className="h-[40px] px-4 rounded-[12px] bg-white border border-[#CBD5E1] text-[#0F172A] text-[12.5px] font-bold inline-flex items-center gap-2 cursor-pointer">
                <FileText className="h-4 w-4" /> Session prep
              </Link>
            </>
          }
          secondaryActions={
            d.can.edit ? (
              <>
                {d.status === 'CONFIRMED' ? (
                  <button type="button" disabled={busy} onClick={() => void act(() => api.patch(`/v1/consult/practice/sessions/${d.id}/status`, { status: 'COMPLETED' }), 'Session completed')} className="h-[40px] px-4 rounded-[12px] bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                    <CheckCircle2 className="h-4 w-4" /> Complete
                  </button>
                ) : null}
                {d.status === 'PENDING_PAYMENT' && d.can.markPaid ? (
                  <button type="button" disabled={busy} onClick={() => void act(() => api.post(`/v1/consult/bookings/${d.id}/mark-paid`, {}), 'Payment recorded')} className="h-[40px] px-4 rounded-[12px] bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                    <Download className="h-4 w-4" /> Mark as paid
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
        <StatusBadge status={d.status} />
        <PaymentChip status={d.status} paymentMethod={d.paymentMethod} holdExpiresAt={d.holdExpiresAt} />
        {d.bookedBy ? <span className="text-[11.5px] text-[#64748B]">Booked by {d.bookedBy}</span> : null}
      </div>

      <Card padding="p-[22px]" className="space-y-4">
        <Eyebrow>THE SESSION</Eyebrow>
        <div className="grid grid-cols-1 @min-[640px]/page:grid-cols-2 gap-3">
          <StatTile variant="inset" size="sm" label="WHEN" value={longWhen(d.startsAt)} />
          <StatTile variant="inset" size="sm" label="SERVICE" value={d.serviceTitle} />
          <StatTile variant="inset" size="sm" label="PRACTITIONER" value={d.provider.name} />
          <StatTile variant="inset" size="sm" label="PAID" value={`${d.paymentMethod === 'NONE' ? 'No charge' : naira(d.amountKobo)} · ${d.channel === 'VIDEO' ? 'Video' : 'In person'}`} />
        </div>
        <p className="text-[12.5px] text-[#64748B]">
          {d.clientEmail}{d.clientPhone ? ` · ${d.clientPhone}` : ''}
          {' · '}
          <Link to={`/dashboard/clients/${d.client.id}`} className="font-bold text-[#0F3A53] underline">Client file</Link>
        </p>
        {d.note ? (
          <p className="text-[12.5px] font-medium text-[#475569] inline-flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4" /> Note {d.note.status === 'COMPLETED' ? 'signed' : 'in draft'}
          </p>
        ) : null}
      </Card>

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
              className="h-[38px] px-4 rounded-[12px] bg-[#0F3A53] text-white text-[12.5px] font-bold cursor-pointer disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              disabled={busy || !recap.trim()}
              onClick={() => void act(() => api.post(`/v1/consult/practice/sessions/${d.id}/recap-email`, {}), 'Recap emailed to the client')}
              className="h-[38px] px-4 rounded-[12px] bg-white border border-[#CBD5E1] text-[#0F172A] text-[12.5px] font-bold cursor-pointer disabled:opacity-50"
            >
              Send recap
            </button>
          </div>
        </Card>
      ) : null}
    </Page>
  );
}
