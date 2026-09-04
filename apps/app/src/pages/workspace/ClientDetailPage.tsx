import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, ChevronRight, FileText, Printer, Lock, Plus, X, Loader2 } from 'lucide-react';
import { Eyebrow, Card, StatusBadge, Button } from '@unclutterdesk/ui';
import { useBrand } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';
import type { Client } from '../../App';

interface ClientDetailPageProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
}

export function ClientDetailPage({ clients, setClients }: ClientDetailPageProps) {
  const { id } = useParams();
  const brand = useBrand();
  const primaryColor = brand.primaryColor || '#0F3A53';

  // Find the selected client from prop list first (immediate render)
  const propClient = clients.find((c) => c.id === id) || clients[0];
  const [client, setClient] = useState<Client>(propClient);

  const [activeTab, setActiveTab] = useState<'history' | 'notes' | 'intake'>('history');
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
      })
      .catch(() => {
        // API unreachable — keep prop data
      });
  }, [id]);

  const selectedNote = client.notes.find((n) => n.id === selectedNoteId) || client.notes[0];

  const handlePrintPDF = () => {
    window.print();
  };

  // Save SOAP Note to API
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingNote(true);
    setNoteError(null);

    try {
      const saved = await api.post<{ id: string; subjective?: string; objective?: string; assessment?: string; plan?: string; isLocked: boolean; updatedAt: string }>(
        '/v1/notes',
        {
          clientProfileId: client.id,
          subjective: noteSubjective || undefined,
          objective: noteObjective || undefined,
          assessment: noteAssessment || undefined,
          plan: notePlan || undefined,
        },
      );

      const now = new Date();
      const newNote = {
        id: saved.id,
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

      // Update local client state
      setClient((prev) => ({
        ...prev,
        notes: [newNote, ...prev.notes],
        sessions: (parseInt(prev.sessions || '0') + 1).toString(),
      }));

      // Also propagate to parent so the list page stays consistent
      setClients((all) =>
        all.map((c) =>
          c.id === client.id
            ? { ...c, notes: [newNote, ...c.notes], sessions: (parseInt(c.sessions || '0') + 1).toString() }
            : c,
        ),
      );

      setSelectedNoteId(newNote.id);
      setShowNewNoteModal(false);
      setNoteSubjective('');
      setNoteObjective('');
      setNoteAssessment('');
      setNotePlan('');
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">
      {/* 70px Header Bar */}
      <header className="h-[70px] bg-white border-b border-[#E2E8F0] px-[26px] flex items-center justify-between gap-5 shrink-0 print:hidden">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/dashboard/clients" className="font-semibold text-[#64748B] hover:text-[#0F172A]">
            Clients
          </Link>
          <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
          <h1 className="font-bold text-[#0F172A]">{client.name}</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrintPDF}
            className="h-[40px] px-4 rounded-[14px] bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-bold hover:bg-[#F8FAFC] flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export file</span>
          </button>
          <button
            onClick={() => {
              setNoteTitle(`Individual Therapy Session #${client.notes.length + 1}`);
              setShowNewNoteModal(true);
            }}
            className="h-[40px] px-4 rounded-[14px] bg-[#EEF2F7] text-[#0F172A] text-xs font-bold hover:bg-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New note</span>
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="p-[24px_26px_30px] space-y-6 flex-1">
        {/* Client Profile Summary Card */}
        <Card padding="p-[24px_26px]" className="space-y-6 bg-white border border-slate-100 shadow-sm rounded-2xl">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-5">
              <div className="h-[76px] w-[76px] rounded-[22px] bg-gradient-to-br from-[#1B5375] to-[#0F3A53] text-[#E3B341] font-extrabold text-[24px] flex items-center justify-center border border-[#E3B341]/30 shadow-md">
                {client.initials}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-[22px] font-bold text-[#0F172A] leading-none">{client.name}</h2>
                  <StatusBadge status={client.status} />
                </div>
                <p className="text-[13px] text-[#64748B] font-medium">
                  {client.email} · {client.phone}
                </p>
              </div>
            </div>
          </div>

          {/* 4 Stat Tiles Grid */}
          <div className="grid grid-cols-4 gap-3.5">
            <div className="p-3.5 rounded-[16px] bg-[#F8FAFC] border border-[#E2E8F0]">
              <Eyebrow className="mb-1">TOTAL SESSIONS</Eyebrow>
              <span className="text-[22px] font-extrabold text-[#0F172A]">{client.sessions}</span>
            </div>
            <div className="p-3.5 rounded-[16px] bg-[#F8FAFC] border border-[#E2E8F0]">
              <Eyebrow className="mb-1">CLIENT SINCE</Eyebrow>
              <span className="text-[18px] font-extrabold text-[#0F172A]">{client.since}</span>
            </div>
            <div className="p-3.5 rounded-[16px] bg-[#F8FAFC] border border-[#E2E8F0]">
              <Eyebrow className="mb-1">NEXT SESSION</Eyebrow>
              <span className="text-[18px] font-extrabold text-[#0F3A53]" style={{ color: primaryColor }}>
                {client.next}
              </span>
            </div>
            <div className="p-3.5 rounded-[16px] bg-[#FEF3C7] border border-[#E3B341]/40">
              <Eyebrow className="mb-1 text-[#92400E]">EMERGENCY CONTACT</Eyebrow>
              <span className="text-[12px] font-bold text-[#92400E] block leading-tight">
                {client.emergency}
              </span>
            </div>
          </div>
        </Card>

        {/* Workspace Tabs */}
        <div className="space-y-4">
          <div className="h-[40px] p-1 bg-[#EEF2F7] rounded-[14px] inline-flex gap-1 border border-[#E2E8F0] print:hidden">
            {[
              { id: 'history', label: 'Session history' },
              { id: 'notes', label: 'SOAP notes' },
              { id: 'intake', label: 'Intake answers' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-5 rounded-[10px] text-xs font-bold transition-all cursor-pointer ${
                  activeTab === t.id ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Session History Timeline */}
          {activeTab === 'history' && (
            <Card padding="p-[24px_26px]" className="space-y-6 bg-white border border-slate-100 shadow-sm rounded-2xl">
              {client.notes.length > 0 ? (
                <div className="space-y-6">
                  {client.notes.map((s, idx) => (
                    <div key={idx} className="grid grid-cols-[96px_24px_1fr] gap-4 items-start">
                      <div className="text-right">
                        <span className="text-[13px] font-bold text-[#0F172A] block">{s.date}</span>
                        <span className="text-[11.5px] font-medium text-[#94A3B8]">{s.time}</span>
                      </div>

                      <div className="flex flex-col items-center h-full pt-1">
                        <span className="h-3 w-3 rounded-full bg-[#E3B341] ring-4 ring-[#E3B341]/20" />
                        <span className="w-0.5 flex-1 bg-[#E2E8F0] my-1" />
                      </div>

                      <div className="p-4 rounded-[18px] bg-white border border-[#E2E8F0] space-y-2 max-w-[720px] shadow-xs">
                        <div className="flex items-center gap-3">
                          <h4 className="text-[14.5px] font-bold text-[#0F172A]">{s.title}</h4>
                          <StatusBadge status={s.status} />
                          <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            {s.note}
                          </span>
                        </div>
                        <p className="text-[13px] text-[#475569] leading-relaxed truncate">{s.subjective}</p>
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
          )}

          {/* Tab 2: SOAP Notes Editor & PDF Export */}
          {activeTab === 'notes' && (
            <div className="grid grid-cols-[1fr_300px] gap-5 items-start">
              {selectedNote ? (
                <Card padding="p-[24px_26px]" className="space-y-4 bg-white border border-slate-100 shadow-sm rounded-2xl">
                  <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                    <div>
                      <h3 className="text-[16px] font-bold text-[#0F172A]">{selectedNote.title}</h3>
                      <p className="text-[11.5px] text-[#64748B]">
                        {selectedNote.date} · {selectedNote.time} · Signed by Practice Owner
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePrintPDF}
                        className="h-9 px-3 rounded-[12px] bg-white border border-[#E2E8F0] text-xs font-bold text-[#0F172A] hover:bg-[#F8FAFC] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Export PDF</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="p-4 rounded-[18px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-5 w-5 rounded-[6px] text-white font-black text-[11px] flex items-center justify-center"
                          style={{ backgroundColor: primaryColor }}
                        >
                          S
                        </span>
                        <strong className="text-xs font-bold text-[#0F172A]">Subjective</strong>
                      </div>
                      <p className="text-[13px] text-[#475569] leading-relaxed">{selectedNote.subjective}</p>
                    </div>

                    <div className="p-4 rounded-[18px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-5 w-5 rounded-[6px] text-white font-black text-[11px] flex items-center justify-center"
                          style={{ backgroundColor: primaryColor }}
                        >
                          O
                        </span>
                        <strong className="text-xs font-bold text-[#0F172A]">Objective</strong>
                      </div>
                      <p className="text-[13px] text-[#475569] leading-relaxed">{selectedNote.objective}</p>
                    </div>

                    <div className="p-4 rounded-[18px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-5 w-5 rounded-[6px] text-white font-black text-[11px] flex items-center justify-center"
                          style={{ backgroundColor: primaryColor }}
                        >
                          A
                        </span>
                        <strong className="text-xs font-bold text-[#0F172A]">Assessment</strong>
                      </div>
                      <p className="text-[13px] text-[#475569] leading-relaxed">{selectedNote.assessment}</p>
                    </div>

                    <div className="p-4 rounded-[18px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-5 w-5 rounded-[6px] text-white font-black text-[11px] flex items-center justify-center"
                          style={{ backgroundColor: primaryColor }}
                        >
                          P
                        </span>
                        <strong className="text-xs font-bold text-[#0F172A]">Plan</strong>
                      </div>
                      <p className="text-[13px] text-[#475569] leading-relaxed">{selectedNote.plan}</p>
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
                            ? 'bg-[#EFF6FB] border-[#0F3A53]/20 text-[#0F3A53]'
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
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <h3 className="text-[16px] font-bold text-[#0F172A]">Pre-Session Intake Answers</h3>
                {client.intakeSummary?.instrument === 'PHQ_9' || client.intakeSummary?.instrument === 'GAD_7' ? (
                  <span className="h-6 px-3 rounded-full bg-[#FEF3C7] text-[#92400E] font-bold text-xs border border-[#E3B341]/40 flex items-center gap-1.5">
                    <span>{client.intakeSummary.instrument === 'PHQ_9' ? 'PHQ-9' : 'GAD-7'}</span>
                    <span>·</span>
                    <span>{client.intakeSummary.totalScore}</span>
                    <span>{client.intakeSummary.severity}</span>
                  </span>
                ) : null}
              </div>

              {client.intake.length > 0 ? (
                <div className="grid grid-cols-2 gap-3.5">
                  {client.intake.map((qa, idx) => (
                    <div key={idx} className="p-4 rounded-[18px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                      <span className="text-[12.5px] font-bold text-[#475569] block">{qa.q}</span>
                      <p className="text-[13.5px] font-medium text-[#0F172A]">{qa.a}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                  Intake form has not been submitted by this client yet.
                </div>
              )}
            </Card>
          )}
        </div>
      </main>

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
            <h3 className="text-lg font-bold text-[#0F172A]">Compose Session SOAP Note</h3>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Note Title</label>
              <input
                type="text"
                required
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="w-full h-10 px-3 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Subjective (S)</label>
                <textarea
                  rows={4}
                  required
                  value={noteSubjective}
                  onChange={(e) => setNoteSubjective(e.target.value)}
                  placeholder="Client feelings, symptoms reported..."
                  className="w-full p-2.5 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs outline-none resize-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Objective (O)</label>
                <textarea
                  rows={4}
                  required
                  value={noteObjective}
                  onChange={(e) => setNoteObjective(e.target.value)}
                  placeholder="Clinician observations, assessments, speech rhythm..."
                  className="w-full p-2.5 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs outline-none resize-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Assessment (A)</label>
                <textarea
                  rows={4}
                  required
                  value={noteAssessment}
                  onChange={(e) => setNoteAssessment(e.target.value)}
                  placeholder="Response to therapy protocols, progress observations..."
                  className="w-full p-2.5 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs outline-none resize-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Plan (P)</label>
                <textarea
                  rows={4}
                  required
                  value={notePlan}
                  onChange={(e) => setNotePlan(e.target.value)}
                  placeholder="Homework assigned, next session date, exercises..."
                  className="w-full p-2.5 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs outline-none resize-none"
                />
              </div>
            </div>

            {noteError && (
              <p className="text-xs font-medium text-red-500 bg-red-50 rounded-[10px] px-3 py-2">{noteError}</p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowNewNoteModal(false)}
                className="flex-1 h-11 rounded-[14px] bg-[#F1F5F9] text-[#475569] font-bold text-xs hover:bg-[#E2E8F0] cursor-pointer"
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
    </div>
  );
}
