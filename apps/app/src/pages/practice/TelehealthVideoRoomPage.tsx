import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck, FileText } from 'lucide-react';
import { api } from '../../utils/apiClient';
import { VideoStage } from '../../components/video/VideoStage';
import { SessionNoteEditor, type SessionNoteValue } from '../../components/notes/SessionNoteEditor';

type RoomNote = SessionNoteValue & { id: string; isLocked: boolean; createdAt: string };

type RoomPayload = {
  booking: {
    id: string;
    clientProfileId: string;
    clientName: string;
    clientEmail: string;
    startsAt: string;
    endsAt: string;
    serviceTitle: string;
    status: string;
    videoRoomLink: string | null;
  };
  /**
   * This session's own note, if one was started. Not `latestNote`: that is the
   * last session's, shown as prep, and it once filled and locked this editor.
   */
  sessionNote?: RoomNote | null;
  submissions: Array<{ id: string; formTitle: string; targetType: string; status: string; submittedAt: string; answers: Array<{ key: string; value: unknown }> }>;
};

export function TelehealthVideoRoomPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [showEndModal, setShowEndModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<RoomPayload | null>(null);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function loadRoom() {
      setLoading(true);
      try {
        const data = await api.get<RoomPayload>(`/v1/consult/therapist/bookings/${id}/prep`);
        if (cancelled) return;
        setPayload(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load telehealth room');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadRoom();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="min-h-screen bg-[var(--desk-sidebar)] text-white font-outfit flex flex-col justify-between p-6 relative">
      {loading ? <div className="rounded-[24px] border border-white/10 bg-[var(--desk-sidebar)] px-6 py-10 text-sm font-medium text-slate-300">Loading telehealth room...</div> : error || !payload ? <div className="rounded-[18px] border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200">{error || 'Telehealth room unavailable'}</div> : (
        <>
          <header className="h-[66px] bg-[var(--desk-sidebar)]/90 backdrop-blur-md border border-white/10 rounded-[20px] px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-slate-300 text-[11.5px] font-bold"><span>SESSION ROOM</span></div>
              <div><h1 className="text-[15px] font-semibold text-white leading-tight">{payload.booking.clientName}</h1><p className="text-[11.5px] text-[var(--desk-text-muted)]">{payload.booking.serviceTitle} · {new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(payload.booking.startsAt))}</p></div>
            </div>
            <div className="flex items-center gap-3"><span className="h-[28px] px-3 rounded-full bg-[var(--desk-active-dot)]/12 text-[var(--desk-active-dot)] text-[10.5px] font-black tracking-wider uppercase border border-[var(--desk-active-dot)]/30 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /><span>PRIVATE ROOM</span></span></div>
          </header>

          <main className="flex-1 my-4 grid grid-cols-12 gap-5 items-stretch min-h-[580px]">
            <div className={`${drawerOpen ? 'col-span-12 lg:col-span-8' : 'col-span-12'} min-h-[580px]`}>
              <VideoStage
                bookingId={payload.booking.id}
                waitingFor={payload.booking.clientName}
                endLabel="End session"
                onLeft={() => setShowEndModal(true)}
                extraButtons={[{ label: 'NOTES', icon: FileText, active: drawerOpen, onClick: () => setDrawerOpen(!drawerOpen) }]}
              />
            </div>

            {drawerOpen ? (
              <div className="col-span-12 lg:col-span-4 bg-[var(--desk-surface)] text-[var(--desk-text)] rounded-[24px] border border-[var(--desk-border)] p-5 flex flex-col justify-between space-y-4 shadow-2xl">
                <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                  {payload.submissions.length > 0 ? <div className="p-3 rounded-[14px] bg-[var(--desk-pine-100)] border border-[var(--desk-info-border)] text-xs font-medium text-[var(--desk-pine-600)]">{payload.submissions[0].formTitle} received · {payload.submissions[0].answers.length} answers available</div> : null}
                  <SessionNoteEditor
                    bookingId={payload.booking.id}
                    clientProfileId={payload.booking.clientProfileId}
                    note={payload.sessionNote ?? null}
                    eyebrow="LIVE DOCUMENTATION"
                    onClose={() => setDrawerOpen(false)}
                  />
                </div>
              </div>
            ) : null}
          </main>


          {showEndModal ? <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-6 z-50"><div className="w-full max-w-[440px] bg-[var(--desk-sidebar-hover)] text-white rounded-[24px] p-6 shadow-2xl space-y-4 border border-slate-700"><h3 className="text-lg font-bold">End this session?</h3><p className="text-xs text-slate-300 mt-1">This ends the call and takes you to the session page, where you can finish and sign the note.</p><div className="flex items-center gap-3 pt-2"><button onClick={() => setShowEndModal(false)} className="flex-1 h-11 rounded-[14px] bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700">Cancel</button><button onClick={() => navigate(`/dashboard/sessions/${payload.booking.id}`)} className="flex-1 h-11 rounded-[14px] bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer">End session</button></div></div></div> : null}
        </>
      )}
    </div>
  );
}
