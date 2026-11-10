import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Download, ChevronRight, FileText, Printer, Lock, Plus, X, Loader2, CalendarPlus } from 'lucide-react';
import { Eyebrow, Card, StatusBadge, Button, useToast, Page, PageHeader, Grid, StatTile, ResponsiveTable, type Column } from '@unclutterdesk/ui';
import { useBrand } from '@unclutterdesk/ui';
import { RichTextEditor } from '../../components/richText/RichTextEditor';
import { RichTextView } from '../../components/richText/RichTextView';
import { hasRichText, richPreview } from '../../components/richText/richDoc';
import { api } from '../../utils/apiClient';
import type { Client } from '../../App';
import { ClientAssessmentsPanel } from '../../components/ClientAssessmentsPanel';
import { EmergencyContactCard } from '../../components/clients/EmergencyContactCard';
import { StaffBookingDialog } from '../../components/booking/StaffBookingDialog';
import { NotScheduledCard } from '../../components/booking/NotScheduledCard';
import { RouterLink } from '../../components/shell/RouterLink';
import { PaymentChip } from '../../components/booking/PaymentChip';
import type { SessionRow } from './SessionsPage';
import { activeDisplayPrefs, formatWhen } from '../../utils/displayFormat';
import { sessionStatus } from '../../utils/sessionStatus';

interface ClientDetailPageProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  /** The Payments tab is for the roles that handle money; App decides. */
  canViewPayments?: boolean;
}

interface PaymentRow {
  /** booking-<id> or plan-<id>: a session paid with no time yet has no booking (§11.2). */
  id: string; bookingId: string | null; serviceTitle: string; sessionAt: string | null; amountKobo: string;
  discountCode: string | null; status: string; paidAt: string | null; reference: string | null; bookedAt: string;
}

const sessionWhen = (iso: string) => formatWhen(iso, 'withYear');

const SESSION_COLUMNS: Column<SessionRow>[] = [
  {
    key: 'service',
    header: 'Session',
    sort: (a, b) => b.startsAt.localeCompare(a.startsAt),
    cell: (r) => (
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-[var(--desk-text)] truncate">{r.serviceTitle}</span>
        <span className="block text-[11.5px] text-[var(--desk-text-subtle)] truncate">{sessionWhen(r.startsAt)}</span>
      </span>
    ),
    className: 'w-full max-w-0',
  },
  { key: 'provider', header: 'Practitioner', priority: 'md', cell: (r) => <span className="truncate">{r.provider.name}</span> },
  { key: 'status', header: 'Status', priority: 'md', cell: (r) => { const st = sessionStatus(r, new Date(), activeDisplayPrefs().timezone); return <StatusBadge status={st.label} tone={st.tone} />; } },
  { key: 'payment', header: 'Payment', priority: 'lg', cell: (r) => <PaymentChip status={r.status} paymentMethod={r.paymentMethod} holdExpiresAt={r.holdExpiresAt} /> },
];

const PAYMENT_COLUMNS: Column<PaymentRow>[] = [
  {
    key: 'service',
    header: 'Session',
    cell: (p) => (
      <span className="min-w-0">
        <span className="block font-bold text-[var(--desk-text)] truncate">{p.serviceTitle}</span>
        <span className="block text-[11.5px] text-[var(--desk-text-subtle)] truncate">{p.sessionAt ? sessionWhen(p.sessionAt) : 'Paid ahead · not scheduled yet'}</span>
      </span>
    ),
    className: 'w-full max-w-0',
  },
  { key: 'amount', header: 'Amount', align: 'end', cell: (p) => `₦${(Number(p.amountKobo) / 100).toLocaleString('en-NG')}` },
  { key: 'paid', header: 'Paid on', priority: 'md', cell: (p) => (p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-GB') : '—') },
  { key: 'ref', header: 'Reference', priority: 'lg', cell: (p) => <span className="text-[11.5px] text-[var(--desk-text-muted)]">{p.reference ?? '—'}</span> },
];

export function ClientDetailPage({ clients, setClients, canViewPayments }: ClientDetailPageProps) {
  const toast = useToast();
  const { id } = useParams();
  const brand = useBrand();
  const primaryColor = brand.primaryColor || '#0F3A53';

  // Find the selected client from prop list first (immediate render)
  const propClient = clients.find((c) => c.id === id) || clients[0];
  const [client, setClient] = useState<Client>(propClient);

  // `?tab=notes&booking=<id>`: where "Write SOAP note" and the note-pending
  // reminder land after a session, to write that session's note.
  const [searchParams] = useSearchParams();
  const forBooking = searchParams.get('booking');
  const [activeTab, setActiveTab] = useState<'history' | 'notes' | 'intake' | 'assessments' | 'payments'>(
    searchParams.get('tab') === 'notes' || forBooking ? 'notes' : 'history',
  );
  const [clientSessions, setClientSessions] = useState<SessionRow[]>([]);
  const [clientPayments, setClientPayments] = useState<{ payments: PaymentRow[]; totalPaidKobo: string; outstandingKobo: string } | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    propClient.notes.length > 0 ? propClient.notes[0].id : null
  );

  // New Note Modal state
  const [showNewNoteModal, setShowNewNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState(`Session Note`);
  const [noteSubjective, setNoteSubjective] = useState('');
  const [noteObjective, setNoteObjective] = useState('');
  const [noteAssessment, setNoteAssessment] = useState('');
  const [notePlan, setNotePlan] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  /** The session the note in the modal is for, when it was opened for one. */
  const [noteBookingId, setNoteBookingId] = useState<string | null>(null);
  const openedForBooking = useRef(false);

  // Fetch fresh client data with live notes from API
  useEffect(() => {
    if (!id) return;
    api
      .get<Client>(`/v1/tenant/clients/${id}`)
      .then((fresh) => {
        setClient(fresh);
        if (fresh.notes.length > 0 && !selectedNoteId) {
          setSelectedNoteId(fresh.notes[0].id);
        }
        if (forBooking && !openedForBooking.current) {
          openedForBooking.current = true;
          openSessionNote(fresh, forBooking);
        }
      })
      .catch(() => {
        // API unreachable — keep prop data
      });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api.get<SessionRow[]>(`/v1/consult/practice/clients/${id}/sessions`).then(setClientSessions).catch(() => setClientSessions([]));
  }, [id]);

  useEffect(() => {
    if (!id || !canViewPayments) return;
    api.get<{ payments: PaymentRow[]; totalPaidKobo: string; outstandingKobo: string }>(`/v1/consult/practice/clients/${id}/payments`)
      .then(setClientPayments)
      .catch(() => setClientPayments({ payments: [], totalPaidKobo: '0', outstandingKobo: '0' }));
  }, [id, canViewPayments]);

  /**
   * A signed note for the session is shown; a draft reopens to carry on; with
   * none, a new note opens. Either way the save is tied to the session.
   */
  function openSessionNote(c: Client, bookingId: string) {
    const existing = c.notes.find((n) => n.bookingId === bookingId);
    if (existing) setSelectedNoteId(existing.id);
    if (existing?.status === 'COMPLETED') return;
    setNoteBookingId(bookingId);
    setNoteTitle(`Individual Therapy Session #${c.notes.length + (existing ? 0 : 1)}`);
    setNoteSubjective(existing?.subjective ?? '');
    setNoteObjective(existing?.objective ?? '');
    setNoteAssessment(existing?.assessment ?? '');
    setNotePlan(existing?.plan ?? '');
    setShowNewNoteModal(true);
  }

  const selectedNote = client.notes.find((n) => n.id === selectedNoteId) || client.notes[0];

  const handlePrintPDF = () => {
    window.print();
  };

  // Save SOAP Note to API
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoteError(null);
    if (![noteSubjective, noteObjective, noteAssessment, notePlan].every(hasRichText)) {
      setNoteError('Write all four sections before saving.');
      return;
    }
    setIsSavingNote(true);

    try {
      const saved = await api.post<{ id: string; subjective?: string; objective?: string; assessment?: string; plan?: string; isLocked: boolean; updatedAt: string }>(
        '/v1/notes',
        {
          clientProfileId: client.id,
          bookingId: noteBookingId ?? undefined,
          subjective: noteSubjective || undefined,
          objective: noteObjective || undefined,
          assessment: noteAssessment || undefined,
          plan: notePlan || undefined,
        },
      );

      const now = new Date();
      const newNote = {
        id: saved.id,
        bookingId: noteBookingId,
        date: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        title: noteTitle || `Session Note`,
        status: saved.isLocked ? 'COMPLETED' : 'DRAFT',
        note: saved.isLocked ? 'NOTE SIGNED' : 'DRAFT',
        subjective: saved.subjective || '',
        objective: saved.objective || '',
        assessment: saved.assessment || '',
        plan: saved.plan || '',
      };

      // A session's draft saved again is the same note, not another one.
      const withNote = <T extends { notes: Client['notes']; sessions: string }>(c: T): T =>
        c.notes.some((n) => n.id === newNote.id)
          ? { ...c, notes: c.notes.map((n) => (n.id === newNote.id ? newNote : n)) }
          : { ...c, notes: [newNote, ...c.notes], sessions: (parseInt(c.sessions || '0') + 1).toString() };

      // Update local client state
      setClient((prev) => withNote(prev));

      // Also propagate to parent so the list page stays consistent
      setClients((all) => all.map((c) => (c.id === client.id ? withNote(c) : c)));

      setSelectedNoteId(newNote.id);
      setShowNewNoteModal(false);
      setNoteBookingId(null);
      setNoteSubjective('');
      setNoteObjective('');
      setNoteAssessment('');
      setNotePlan('');
      toast.success('Note saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the note');
      setNoteError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <Page
      header={
        <PageHeader
          breadcrumb={
            <>
              <Link to="/dashboard/clients" className="font-semibold text-[var(--desk-text-muted)] hover:text-[var(--desk-text)]">
                Clients
              </Link>
              <ChevronRight className="h-4 w-4 text-[var(--desk-text-subtle)]" />
            </>
          }
          title={client.name}
          actions={
            <>
              <button
                type="button"
                onClick={() => setShowBooking(true)}
                className="h-[38px] px-3.5 rounded-[12px] bg-[var(--desk-pine-600)] text-white text-[12.5px] font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <CalendarPlus className="h-4 w-4" /> Book a session
              </button>
              <button
                onClick={() => {
                  setNoteBookingId(null);
                  setNoteTitle(`Individual Therapy Session #${client.notes.length + 1}`);
                  setShowNewNoteModal(true);
                }}
                className="h-[40px] px-4 rounded-[14px] bg-[var(--desk-surface-muted)] text-[var(--desk-text)] text-xs font-bold hover:bg-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>New note</span>
              </button>
            </>
          }
          secondaryActions={
            <button
              onClick={handlePrintPDF}
              className="h-[40px] px-4 rounded-[14px] bg-white border border-[var(--desk-pine-200)] text-[var(--desk-text)] text-xs font-bold hover:bg-[var(--desk-surface)] flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export file</span>
            </button>
          }
        />
      }
    >
        {/* Client Profile Summary Card */}
        <Card padding="p-[24px_26px]" className="space-y-6 bg-white border border-slate-100 shadow-sm rounded-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4 md:gap-5 min-w-0">
              <div className="h-[76px] w-[76px] rounded-[22px] bg-gradient-to-br from-[var(--desk-pine-500)] to-[var(--desk-pine-600)] text-[var(--ds-sky)] font-extrabold text-[24px] flex items-center justify-center border border-[var(--desk-pending-border)]/30 shadow-md">
                {client.initials}
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-[22px] font-bold text-[var(--desk-text)] leading-none">{client.name}</h2>
                  <StatusBadge status={client.status} />
                </div>
                <p className="text-[13px] text-[var(--desk-text-muted)] font-medium truncate">
                  {client.email} · {client.phone}
                </p>
              </div>
            </div>
          </div>

          {/* 4 Stat Tiles Grid */}
          <Grid cols={{ base: 1, sm: 2, lg: 4 }} gap="md">
            <StatTile variant="inset" label="TOTAL SESSIONS" value={client.sessions} />
            <StatTile variant="inset" size="sm" label="CLIENT SINCE" value={client.since} />
            <StatTile variant="inset" size="sm" label="NEXT SESSION" value={client.next} valueColor={primaryColor} />
            <EmergencyContactCard
              clientId={client.id}
              contact={client.emergencyContact ?? null}
              onSaved={(c) => setClient((prev) => ({ ...prev, emergencyContact: c }))}
            />
          </Grid>
        </Card>

        <NotScheduledCard
          client={{ id: client.id, name: client.name }}
          onScheduled={() => {
            api.get<SessionRow[]>(`/v1/consult/practice/clients/${client.id}/sessions`).then(setClientSessions).catch(() => undefined);
          }}
        />

        {/* Workspace Tabs */}
        <div className="space-y-4">
          <div className="h-[40px] p-1 bg-[var(--desk-surface-muted)] rounded-[14px] inline-flex max-w-full overflow-x-auto gap-1 border border-[var(--desk-border)] print:hidden">
            {[
              { id: 'history', label: 'Session history' },
              { id: 'notes', label: 'SOAP notes' },
              { id: 'intake', label: 'Intake answers' },
              { id: 'assessments', label: 'Assessments' },
              ...(canViewPayments ? [{ id: 'payments', label: 'Payments' }] : []),
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-5 shrink-0 whitespace-nowrap rounded-[10px] text-xs font-bold transition-all cursor-pointer ${
                  activeTab === t.id ? 'bg-white text-[var(--desk-text)] shadow-xs' : 'text-[var(--desk-text-muted)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Session History Timeline */}
          {activeTab === 'history' && (
            <>
              <div className="rounded-[20px] border border-[var(--desk-border)] bg-white overflow-hidden">
                <ResponsiveTable<SessionRow>
                  caption={`Sessions for ${client.name}`}
                  rows={clientSessions}
                  rowKey={(r) => r.id}
                  rowLabel={(r) => `${r.serviceTitle}, ${sessionWhen(r.startsAt)}`}
                  columns={SESSION_COLUMNS}
                  rowHref={(r) => `/dashboard/sessions/${r.id}`}
                  LinkComponent={RouterLink}
                  empty="No sessions yet."
                />
              </div>
              <Card padding="p-[24px_26px]" className="space-y-6 bg-white border border-slate-100 shadow-sm rounded-2xl">
              {client.notes.length > 0 ? (
                <div className="space-y-6">
                  {client.notes.map((s, idx) => (
                    <div key={idx} className="grid grid-cols-[96px_24px_1fr] gap-4 items-start">
                      <div className="text-right">
                        <span className="text-[13px] font-bold text-[var(--desk-text)] block">{s.date}</span>
                        <span className="text-[11.5px] font-medium text-[var(--desk-text-subtle)]">{s.time}</span>
                      </div>

                      <div className="flex flex-col items-center h-full pt-1">
                        <span className="h-3 w-3 rounded-full bg-[var(--ds-sky)] ring-4 ring-[var(--desk-pending-border)]/20" />
                        <span className="w-0.5 flex-1 bg-[var(--desk-border)] my-1" />
                      </div>

                      <div className="min-w-0 p-4 rounded-[18px] bg-white border border-[var(--desk-border)] space-y-2 max-w-[720px] shadow-xs">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <h4 className="text-[14.5px] font-bold text-[var(--desk-text)] min-w-0 truncate">{s.title}</h4>
                          <StatusBadge status={s.status} />
                          <span className="shrink-0 text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            {s.note}
                          </span>
                        </div>
                        <p className="text-[13px] text-[var(--desk-text-body)] leading-relaxed truncate">{richPreview(s.subjective)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                  No sessions have been scheduled yet.
                </div>
              )}
            </Card>
            </>
          )}

          {activeTab === 'payments' && canViewPayments ? (
            <Card padding="p-[24px_26px]" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StatTile label="TOTAL PAID" value={`₦${(Number(clientPayments?.totalPaidKobo ?? 0) / 100).toLocaleString('en-NG')}`} />
                <StatTile label="OUTSTANDING" value={`₦${(Number(clientPayments?.outstandingKobo ?? 0) / 100).toLocaleString('en-NG')}`} />
              </div>
              <div className="rounded-[20px] border border-[var(--desk-border)] bg-white overflow-hidden">
                <ResponsiveTable<PaymentRow>
                  caption={`Payments for ${client.name}`}
                  rows={clientPayments?.payments ?? []}
                  rowKey={(p) => p.id}
                  columns={PAYMENT_COLUMNS}
                  state={clientPayments ? 'ready' : 'loading'}
                  empty="No payments yet."
                />
              </div>
            </Card>
          ) : null}

          {/* Tab 2: SOAP Notes Editor & PDF Export */}
          {activeTab === 'notes' && (
            <div className="grid grid-cols-1 @min-[960px]/page:grid-cols-[1fr_300px] gap-5 items-start">
              {selectedNote ? (
                <Card padding="p-[24px_26px]" className="space-y-4 bg-white border border-slate-100 shadow-sm rounded-2xl">
                  <div className="flex items-center justify-between border-b border-[var(--desk-border)] pb-3">
                    <div>
                      <h3 className="text-[16px] font-bold text-[var(--desk-text)]">{selectedNote.title}</h3>
                      <p className="text-[11.5px] text-[var(--desk-text-muted)]">
                        {selectedNote.date} · {selectedNote.time} · Signed by Practice Owner
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePrintPDF}
                        className="h-9 px-3 rounded-[12px] bg-white border border-[var(--desk-border)] text-xs font-bold text-[var(--desk-text)] hover:bg-[var(--desk-surface)] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Export PDF</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="p-4 rounded-[18px] bg-[var(--desk-surface)] border border-[var(--desk-border)] space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-5 w-5 rounded-[6px] text-white font-black text-[11px] flex items-center justify-center"
                          style={{ backgroundColor: primaryColor }}
                        >
                          S
                        </span>
                        <strong className="text-xs font-bold text-[var(--desk-text)]">Subjective</strong>
                      </div>
                      <RichTextView value={selectedNote.subjective} />
                    </div>

                    <div className="p-4 rounded-[18px] bg-[var(--desk-surface)] border border-[var(--desk-border)] space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-5 w-5 rounded-[6px] text-white font-black text-[11px] flex items-center justify-center"
                          style={{ backgroundColor: primaryColor }}
                        >
                          O
                        </span>
                        <strong className="text-xs font-bold text-[var(--desk-text)]">Objective</strong>
                      </div>
                      <RichTextView value={selectedNote.objective} />
                    </div>

                    <div className="p-4 rounded-[18px] bg-[var(--desk-surface)] border border-[var(--desk-border)] space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-5 w-5 rounded-[6px] text-white font-black text-[11px] flex items-center justify-center"
                          style={{ backgroundColor: primaryColor }}
                        >
                          A
                        </span>
                        <strong className="text-xs font-bold text-[var(--desk-text)]">Assessment</strong>
                      </div>
                      <RichTextView value={selectedNote.assessment} />
                    </div>

                    <div className="p-4 rounded-[18px] bg-[var(--desk-surface)] border border-[var(--desk-border)] space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-5 w-5 rounded-[6px] text-white font-black text-[11px] flex items-center justify-center"
                          style={{ backgroundColor: primaryColor }}
                        >
                          P
                        </span>
                        <strong className="text-xs font-bold text-[var(--desk-text)]">Plan</strong>
                      </div>
                      <RichTextView value={selectedNote.plan} />
                    </div>
                  </div>
                </Card>
              ) : (
                <Card padding="p-[24px_26px]" className="text-center text-slate-400 text-xs font-semibold bg-white border border-slate-100 shadow-sm rounded-2xl">
                  No SOAP notes written for this client.
                </Card>
              )}

              {/* Right Side: Note History */}
              <div className="space-y-4">
                <Card padding="p-4" className="space-y-3 bg-white border border-slate-100 shadow-sm rounded-2xl">
                  <Eyebrow>NOTE HISTORY</Eyebrow>
                  <div className="space-y-2 text-xs">
                    {client.notes.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => setSelectedNoteId(n.id)}
                        className={`p-2.5 rounded-[12px] border font-bold cursor-pointer transition-all ${
                          selectedNoteId === n.id || (!selectedNoteId && client.notes[0]?.id === n.id)
                            ? 'bg-[var(--desk-pine-100)] border-[var(--desk-pine-600)]/20 text-[var(--desk-pine-600)]'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {n.title} · {n.date}
                      </div>
                    ))}
                    {client.notes.length === 0 && (
                      <span className="text-slate-400 font-semibold block text-center py-4">
                        History empty
                      </span>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Tab 3: Intake Questionnaire Answers */}
          {activeTab === 'intake' && (
            <Card padding="p-[24px_26px]" className="space-y-4 bg-white border border-slate-100 shadow-sm rounded-2xl">
              <div className="flex items-center justify-between border-b border-[var(--desk-border)] pb-3">
                <h3 className="text-[16px] font-bold text-[var(--desk-text)]">Pre-Session Intake Answers</h3>
                {client.intakeSummary?.instrument === 'PHQ_9' || client.intakeSummary?.instrument === 'GAD_7' ? (
                  <span className="h-6 px-3 rounded-full bg-[var(--desk-pending-bg)] text-[var(--desk-pending)] font-bold text-xs border border-[var(--desk-pending-border)]/40 flex items-center gap-1.5">
                    <span>{client.intakeSummary.instrument === 'PHQ_9' ? 'PHQ-9' : 'GAD-7'}</span>
                    <span>·</span>
                    <span>{client.intakeSummary.totalScore}</span>
                    <span>{client.intakeSummary.severity}</span>
                  </span>
                ) : null}
              </div>

              {client.intake.length > 0 ? (
                <Grid cols={{ base: 1, md: 2 }}>
                  {client.intake.map((qa, idx) => (
                    <div key={idx} className="p-4 rounded-[18px] bg-[var(--desk-surface)] border border-[var(--desk-border)] space-y-1">
                      <span className="text-[12.5px] font-bold text-[var(--desk-text-body)] block">{qa.q}</span>
                      <p className="text-[13.5px] font-medium text-[var(--desk-text)]">{qa.a}</p>
                    </div>
                  ))}
                </Grid>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                  Intake form has not been submitted by this client yet.
                </div>
              )}
            </Card>
          )}

          {activeTab === 'assessments' && (
            <ClientAssessmentsPanel clientId={client.id} clientName={client.name} primaryColor={primaryColor} />
          )}
        </div>

      {/* New SOAP Note Modal */}
      {showNewNoteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-6 z-50 animate-fade-in">
          <form
            onSubmit={handleSaveNote}
            className="w-full max-w-[560px] bg-white rounded-[24px] p-6 shadow-2xl space-y-4 border border-slate-200 relative"
          >
            <button
              type="button"
              onClick={() => setShowNewNoteModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-[var(--desk-text)]">Compose Session SOAP Note</h3>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Note Title</label>
              <input
                type="text"
                required
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="w-full h-10 px-3 rounded-[10px] bg-[var(--desk-surface)] border border-[var(--desk-border)] text-xs font-semibold outline-none"
              />
            </div>

            <Grid cols={{ base: 1, md: 2 }}>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Subjective (S)</label>
                <RichTextEditor label="Subjective" value={noteSubjective} onChange={setNoteSubjective} placeholder="Client feelings, symptoms reported..." minHeight={88} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Objective (O)</label>
                <RichTextEditor label="Objective" value={noteObjective} onChange={setNoteObjective} placeholder="Clinician observations, assessments, speech rhythm..." minHeight={88} />
              </div>
            </Grid>

            <Grid cols={{ base: 1, md: 2 }}>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Assessment (A)</label>
                <RichTextEditor label="Assessment" value={noteAssessment} onChange={setNoteAssessment} placeholder="Response to therapy protocols, progress observations..." minHeight={88} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Plan (P)</label>
                <RichTextEditor label="Plan" value={notePlan} onChange={setNotePlan} placeholder="Homework assigned, next session date, exercises..." minHeight={88} />
              </div>
            </Grid>

            {noteError && (
              <p className="text-xs font-medium text-red-500 bg-red-50 rounded-[10px] px-3 py-2">{noteError}</p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowNewNoteModal(false)}
                className="flex-1 h-11 rounded-[14px] bg-[var(--desk-surface-muted)] text-[var(--desk-text-body)] font-bold text-xs hover:bg-[var(--desk-border)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingNote}
                className="flex-1 h-11 rounded-[14px] text-white font-bold text-xs hover:brightness-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: primaryColor }}
              >
                {isSavingNote && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isSavingNote ? 'Saving...' : 'Save & Sign Note'}
              </button>
            </div>
          </form>
        </div>
      )}
      {showBooking && (
        <StaffBookingDialog
          client={{ id: client.id, name: client.name }}
          onClose={() => setShowBooking(false)}
          onBooked={() => { setShowBooking(false); window.location.reload(); }}
        />
      )}
    </Page>
  );
}
