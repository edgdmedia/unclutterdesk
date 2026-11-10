import { useEffect, useState } from 'react';
import { JoinButton } from '../../components/video/JoinButton';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Download, FileText, Loader2, PencilLine, Star } from 'lucide-react';
import { Card, Eyebrow, Page, PageHeader, SegmentedControl, StatTile, StatusBadge, useToast } from '@unclutterdesk/ui';
import { PaymentChip } from '../../components/booking/PaymentChip';
import { EditSessionDialog } from '../../components/booking/EditSessionDialog';
import { SessionNoteEditor } from '../../components/notes/SessionNoteEditor';
import { RichTextEditor } from '../../components/richText/RichTextEditor';
import { RecapAssessmentsPicker, type SentAssessment } from '../../components/notes/RecapAssessmentsPicker';
import { hasRichText } from '../../components/richText/richDoc';
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
  /** The text comes only to staff who may write notes (can.summary). */
  note: { id: string; status: 'DRAFT' | 'COMPLETED'; subjective?: string; objective?: string; assessment?: string; plan?: string } | null;
  internalSummary: string | null;
  clientRecap: string | null;
  /** Only sent to clinical staff. */
  supervisionNotes?: string | null;
  clientRecapSentAt: string | null;
  /** When the client was emailed a review request for this session; once per session. */
  reviewRequestedAt?: string | null;
  /** Left for the client to schedule (§11.2): this booking was freed, its payment kept. */
  unscheduledAt?: string | null;
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
  const { hash } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const [d, setD] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [internal, setInternal] = useState('');
  const [recap, setRecap] = useState('');
  const [supervision, setSupervision] = useState('');
  // Questionnaires attached to the recap, as saved and as on screen.
  const [attached, setAttached] = useState<string[]>([]);
  const [savedAttached, setSavedAttached] = useState<string[]>([]);
  const [sentAssessments, setSentAssessments] = useState<SentAssessment[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  // BKG-06: whether the client's default forms are in yet.
  const [forms, setForms] = useState<{ intake: boolean; confidentiality: boolean } | null>(null);

  const tabParam = searchParams.get('tab');
  // `#note` links (the client page and the room) still open the SOAP notes tab.
  const activeTab: 'notes' | 'summary' =
    d?.status === 'CANCELLED' ? 'summary' : hash === '#note' || tabParam === 'notes' ? 'notes' : 'summary';
  const tabOptions = d?.status === 'CANCELLED' ? ['Summary'] : ['SOAP notes', 'Summary'];

  useEffect(() => {
    api.get<SessionDetail>(`/v1/consult/practice/sessions/${id}`)
      .then((r) => {
        setD(r);
        setInternal(r.internalSummary ?? '');
        setRecap(r.clientRecap ?? '');
        setSupervision(r.supervisionNotes ?? '');
        if (r.can.summary) void loadRecapAssessments();
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

  // `#note` (the "Write SOAP note" prompt, the note-pending reminder): open the
  // SOAP tab, then scroll once the tab's content is on screen.
  const loaded = d !== null;
  useEffect(() => {
    if (!loaded || hash !== '#note' || searchParams.get('tab') === 'notes') return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'notes');
    setSearchParams(next, { replace: true });
  }, [loaded, hash, searchParams, setSearchParams]);

  useEffect(() => {
    if (loaded && activeTab === 'notes' && hash === '#note') {
      document.getElementById('note')?.scrollIntoView?.({ block: 'start' });
    }
  }, [loaded, activeTab, hash]);

  /** The three texts as they are on screen. */
  async function loadRecapAssessments() {
    try {
      const r = await api.get<{ recapAssessmentKeys: string[]; sentAssessments: SentAssessment[] }>(`/v1/consult/practice/sessions/${id}/recap`);
      setAttached(r.recapAssessmentKeys ?? []);
      setSavedAttached(r.recapAssessmentKeys ?? []);
      setSentAssessments(r.sentAssessments ?? []);
    } catch {
      // The recap still works without the list; the picker shows nothing attached.
    }
  }

  /** The texts and attached questionnaires as they are on screen. */
  async function saveSummary() {
    await api.patch(`/v1/consult/practice/sessions/${id}/summary`, { internalSummary: internal, clientRecap: recap, supervisionNotes: supervision });
    if (attached.join() !== savedAttached.join()) {
      await api.put(`/v1/consult/practice/sessions/${id}/recap-assessments`, { keys: attached });
      setSavedAttached(attached);
    }
  }

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

  function showTab(label: string) {
    const next = new URLSearchParams(searchParams);
    next.set('tab', label === 'SOAP notes' ? 'notes' : 'summary');
    setSearchParams(next, { replace: true });
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
                {d.status !== 'CANCELLED' ? (
                  <button type="button" disabled={busy} onClick={() => setEditing(true)} className="h-[40px] px-4 rounded-[12px] bg-white border border-[var(--desk-pine-200)] text-[var(--desk-text)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                    <PencilLine className="h-4 w-4" /> Edit session
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
        {(() => { const st = sessionStatus(d, new Date(), activeDisplayPrefs().timezone); return <StatusBadge status={st.label} tone={st.tone} />; })()}
        <PaymentChip status={d.status} paymentMethod={d.paymentMethod} holdExpiresAt={d.holdExpiresAt} />
        {d.bookedBy ? <span className="text-[11.5px] text-[var(--desk-text-muted)]">Booked by {d.bookedBy}</span> : null}
      </div>

      {d.unscheduledAt ? (
        <div role="status" className="rounded-[14px] border border-[var(--desk-border)] bg-[var(--desk-surface)] px-4 py-3 text-[13px] text-[var(--desk-text-body)]">
          Left for {d.client.name} to schedule on {new Date(d.unscheduledAt).toLocaleDateString('en-GB')}. The payment stays here; the new time is on{' '}
          <Link to={`/dashboard/clients/${d.client.id}`} className="font-bold text-[var(--desk-pine-600)] underline">their client page</Link> once chosen.
        </div>
      ) : null}

      <Card padding="p-[22px]" className="space-y-4">
        <Eyebrow>THE SESSION</Eyebrow>
        <div className="grid grid-cols-1 @min-[640px]/page:grid-cols-2 gap-3">
          <StatTile variant="inset" size="sm" label="WHEN" value={longWhen(d.startsAt)} />
          <StatTile variant="inset" size="sm" label="SERVICE" value={d.serviceTitle} />
          <StatTile variant="inset" size="sm" label="PRACTITIONER" value={d.provider.name} />
          <StatTile variant="inset" size="sm" label="PAID" value={d.paymentMethod === 'NONE' ? 'No charge' : d.paymentMethod === 'PLAN' ? 'Paid on an earlier booking' : naira(d.amountKobo)} />
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
        {d.status === 'COMPLETED' && (d.can.edit || d.can.summary) ? (
          // Never automatic: many therapy ethics codes caution against asking a
          // client still in care for a testimonial, so this is the practitioner's call.
          d.reviewRequestedAt ? (
            <p className="text-[12.5px] font-medium text-[var(--desk-text-body)] inline-flex items-center gap-1.5">
              <Star className="h-4 w-4" /> Review requested {new Date(d.reviewRequestedAt).toLocaleDateString('en-GB')}
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void act(() => api.post(`/v1/consult/practice/sessions/${d.id}/review-request`, {}), `Review request emailed to ${d.client.name}`)}
                className="h-[36px] px-3 rounded-[10px] bg-white border border-[var(--desk-pine-200)] text-[var(--desk-text)] text-[12px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Star className="h-4 w-4" /> Ask for a review
              </button>
              <span className="text-[11.5px] text-[var(--desk-text-muted)]">Emails {d.client.name} a link to your review form. Asked once per session.</span>
            </div>
          )
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

      {editing ? (
        <EditSessionDialog
          session={d}
          onClose={() => setEditing(false)}
          onMoved={(r) => {
            setEditing(false);
            toast.success(`Session moved to ${longWhen(r.startsAt)}. The client has been emailed.`);
            void api.get<SessionDetail>(`/v1/consult/practice/sessions/${id}`).then(setD).catch(() => undefined);
          }}
          onLeftForClient={() => {
            setEditing(false);
            toast.success(`${d.client.name} has been emailed to choose a new time. The session stays paid.`);
            void api.get<SessionDetail>(`/v1/consult/practice/sessions/${id}`).then(setD).catch(() => undefined);
          }}
          onServiceChanged={(r) => {
            setEditing(false);
            const owed = r.balanceKobo ? ` ${naira(r.balanceKobo)} is still owed.` : '';
            const over = r.overpaidKobo !== '0' ? ` The client paid ${naira(r.overpaidKobo)} more than the new price.` : '';
            toast.success(`Now ${r.serviceTitle}.${owed}${over}`);
            void api.get<SessionDetail>(`/v1/consult/practice/sessions/${id}`).then(setD).catch(() => undefined);
          }}
        />
      ) : null}

      {d.can.summary ? (
        <div className="space-y-4">
          <div className="flex max-w-full overflow-x-auto">
            <SegmentedControl
              options={tabOptions}
              value={activeTab === 'notes' ? 'SOAP notes' : 'Summary'}
              onChange={showTab}
            />
          </div>

          {activeTab === 'notes' && d.status !== 'CANCELLED' ? (
            // The session's note lives here as well as in the room: after a call in
            // Google Meet the room is never reopened, and the note is written later.
            <Card padding="p-[22px]" className="space-y-3" id="note">
              <SessionNoteEditor key={d.id} bookingId={d.id} clientProfileId={d.client.id} note={d.note ? { ...d.note, isLocked: d.note.status === 'COMPLETED' } : null} />
            </Card>
          ) : null}

          {activeTab === 'summary' ? (
            <Card padding="p-[22px]" className="space-y-3">
              <Eyebrow>SUMMARY</Eyebrow>
              <div className="space-y-1.5">
                <div className="text-[11.5px] font-bold text-slate-500 uppercase">Internal summary (staff only)</div>
                <RichTextEditor label="Internal summary" value={internal} onChange={setInternal} placeholder="What happened, for the file." minHeight={64} />
              </div>
              <div className="space-y-1.5">
                <div className="text-[11.5px] font-bold text-slate-500 uppercase">Supervision notes (clinical staff only)</div>
                <RichTextEditor label="Supervision notes" value={supervision} onChange={setSupervision} placeholder="Points to take to supervision: the relationship, your own process, risk, pacing." minHeight={64} />
              </div>
              <div className="space-y-1.5">
                <div className="text-[11.5px] font-bold text-slate-500 uppercase">Client recap</div>
                <RichTextEditor label="Client recap" value={recap} onChange={setRecap} placeholder="Written for the client: what was covered, what to practise." minHeight={96} />
              </div>
              <RecapAssessmentsPicker value={attached} onChange={setAttached} sent={sentAssessments} />
              {d.clientRecapSentAt ? (
                <p className="text-[11.5px] text-emerald-700 font-semibold">Recap sent {new Date(d.clientRecapSentAt).toLocaleDateString('en-GB')}.</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(saveSummary, 'Summary saved')}
                  className="h-[38px] px-4 rounded-[12px] bg-[var(--desk-pine-600)] text-white text-[12.5px] font-bold cursor-pointer disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  disabled={busy || !hasRichText(recap)}
                  // What is on screen is what is sent: save first.
                  onClick={() =>
                    void act(async () => {
                      await saveSummary();
                      await api.post(`/v1/consult/practice/sessions/${d.id}/recap-email`, {});
                      await loadRecapAssessments();
                    }, 'Recap emailed to the client')
                  }
                  className="h-[38px] px-4 rounded-[12px] bg-white border border-[var(--desk-pine-200)] text-[var(--desk-text)] text-[12.5px] font-bold cursor-pointer disabled:opacity-50"
                >
                  Send recap
                </button>
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}
    </Page>
  );
}
