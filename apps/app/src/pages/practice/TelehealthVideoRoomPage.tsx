import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, Monitor, MessageSquare, PhoneOff, Lock, ShieldCheck, Check, FileText } from 'lucide-react';
import { api } from '../../utils/apiClient';

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
  latestNote: {
    id: string;
    subjective?: string | null;
    objective?: string | null;
    assessment?: string | null;
    plan?: string | null;
    isLocked: boolean;
    createdAt: string;
  } | null;
  submissions: Array<{ id: string; formTitle: string; targetType: string; status: string; submittedAt: string; answers: Array<{ key: string; value: unknown }> }>;
};

export function TelehealthVideoRoomPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<RoomPayload | null>(null);
  const [noteLocked, setNoteLocked] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function loadRoom() {
      setLoading(true);
      try {
        const data = await api.get<RoomPayload>(`/v1/consult/therapist/bookings/${id}/prep`);
        if (cancelled) return;
        setPayload(data);
        setNoteId(data.latestNote?.id || null);
        setNoteLocked(Boolean(data.latestNote?.isLocked));
        setSubjective(data.latestNote?.subjective || '');
        setObjective(data.latestNote?.objective || '');
        setAssessment(data.latestNote?.assessment || '');
        setPlan(data.latestNote?.plan || '');
        setSaveState('idle');
        setLastSavedAt(null);
        setHydrated(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load telehealth room');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadRoom();
    return () => { cancelled = true; };
  }, [id]);

  async function saveNote() {
    if (!payload || noteLocked) return null;
    setSaveState('saving');
    try {
      const saved = await api.post<{ id: string; isLocked: boolean; subjective?: string; objective?: string; assessment?: string; plan?: string }>('/v1/notes', {
        bookingId: payload.booking.id,
        clientProfileId: payload.booking.clientProfileId,
        subjective,
        objective,
        assessment,
        plan,
      });
      setNoteId(saved.id);
      setNoteLocked(saved.isLocked);
      setLastSavedAt(new Date().toISOString());
      setSaveState('saved');
      return saved;
    } catch (error) {
      setSaveState('error');
      throw error;
    }
  }

  async function lockNote() {
    const saved = await saveNote();
    const targetNoteId = saved?.id || noteId;
    if (targetNoteId) {
      await api.patch(`/v1/notes/${targetNoteId}/lock`, {});
      setNoteLocked(true);
      setSaveState('saved');
    }
  }

  useEffect(() => {
    if (!payload || noteLocked || !hydrated) return;
    setSaveState((current) => (current === 'idle' || current === 'saved' ? 'dirty' : current));
  }, [subjective, objective, assessment, plan, payload, noteLocked, hydrated]);

  useEffect(() => {
    if (!payload || noteLocked || saveState !== 'dirty') return;

    const timeout = window.setTimeout(() => {
      void saveNote().catch(() => {
        // saveNote already updates the visible error state
      });
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [payload, noteLocked, saveState, subjective, objective, assessment, plan]);

  const roomLink = payload?.booking.videoRoomLink;

  return (
    <div className="min-h-screen bg-[#0B1220] text-white font-outfit flex flex-col justify-between p-6 relative">
      {loading ? <div className="rounded-[24px] border border-white/10 bg-[#101A28] px-6 py-10 text-sm font-medium text-slate-300">Loading telehealth room...</div> : error || !payload ? <div className="rounded-[18px] border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200">{error || 'Telehealth room unavailable'}</div> : (
        <>
          <header className="h-[66px] bg-[#0B1220]/90 backdrop-blur-md border border-white/10 rounded-[20px] px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-slate-300 text-[11.5px] font-bold"><span>ROOM PREVIEW</span></div>
              <div><h1 className="text-[15px] font-semibold text-white leading-tight">{payload.booking.clientName}</h1><p className="text-[11.5px] text-[#64748B]">{payload.booking.serviceTitle} · {new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(payload.booking.startsAt))}</p></div>
            </div>
            <div className="flex items-center gap-3"><span className="h-[28px] px-3 rounded-full bg-[#34D399]/12 text-[#34D399] text-[10.5px] font-black tracking-wider uppercase border border-[#34D399]/30 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /><span>ROOM CONTEXT REAL</span></span></div>
          </header>

          <main className="flex-1 my-4 grid grid-cols-12 gap-5 items-stretch min-h-[580px]">
            <div className={`${drawerOpen ? 'col-span-8' : 'col-span-12'} rounded-[22px] border border-white/[0.06] relative overflow-hidden flex items-center justify-center`} style={{ background: 'radial-gradient(120% 120% at 30% 20%, #1E3448 0%, #101A28 60%, #0B1220 100%)' }}>
              <div className="text-center space-y-3 z-10">
                <div className="h-[150px] w-[150px] rounded-full bg-gradient-to-br from-[#1B5375] to-[#0F3A53] text-[#E3B341] font-extrabold text-[48px] flex items-center justify-center mx-auto shadow-2xl border-2 border-[#E3B341]/30">{payload.booking.clientName.split(' ').slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase()}</div>
                <h2 className="text-[19px] font-semibold text-white">{payload.booking.clientName}</h2>
                <p className="text-xs text-[#34D399] font-medium">Realtime media is still placeholder; booking/note context is real.</p>
                {roomLink ? <a href={roomLink} target="_blank" rel="noreferrer" className="inline-flex h-[42px] items-center justify-center rounded-[14px] bg-[#E3B341] px-4 text-[12.5px] font-bold text-[#0F172A]">Open video room</a> : null}
              </div>
            </div>

            {drawerOpen ? (
              <div className="col-span-4 bg-[#F8FAFC] text-[#0F172A] rounded-[24px] border border-[#E2E8F0] p-5 flex flex-col justify-between space-y-4 shadow-2xl">
                <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                  <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3"><div><span className="os-eyebrow block">LIVE DOCUMENTATION</span><h3 className="text-[17px] font-bold text-[#0F172A]">SOAP Notes</h3></div><div className="flex items-center gap-3"><div className="flex items-center gap-2 text-[11px] font-bold">{saveState === 'saving' ? <span className="text-[#B45309]">Saving...</span> : null}{saveState === 'saved' ? <span className="text-[#15803D]">Saved{lastSavedAt ? ` · ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(lastSavedAt))}` : ''}</span> : null}{saveState === 'error' ? <span className="text-[#DC2626]">Autosave failed</span> : null}{noteLocked ? <span className="text-[#475569]">Locked</span> : null}</div><button onClick={() => setDrawerOpen(false)} className="h-8 w-8 rounded-full bg-[#EEF2F7] hover:bg-slate-200 text-[#64748B] flex items-center justify-center font-bold text-xs cursor-pointer">✕</button></div></div>
                  {payload.submissions.length > 0 ? <div className="p-3 rounded-[14px] bg-[#EFF6FB] border border-[#BFDBFE] text-xs font-medium text-[#0F3A53]">{payload.submissions[0].formTitle} received · {payload.submissions[0].answers.length} answers available</div> : null}
                  {[{ chip: 'S', title: 'Subjective', val: subjective, setVal: setSubjective }, { chip: 'O', title: 'Objective', val: objective, setVal: setObjective }, { chip: 'A', title: 'Assessment', val: assessment, setVal: setAssessment }, { chip: 'P', title: 'Plan', val: plan, setVal: setPlan }].map((section) => (
                    <div key={section.chip} className="p-3.5 rounded-[18px] bg-white border border-[#E2E8F0] space-y-2 shadow-xs">
                      <div className="flex items-center gap-2"><span className="h-6 w-6 rounded-[8px] bg-[#0F3A53] text-[#E3B341] font-black text-xs flex items-center justify-center">{section.chip}</span><span className="text-[12.5px] font-bold text-[#0F172A] tracking-tight">{section.title}</span></div>
                      <textarea rows={2} disabled={noteLocked} value={section.val} onChange={(e) => section.setVal(e.target.value)} className="w-full text-[13px] text-[#475569] font-medium leading-relaxed bg-transparent border-none outline-none resize-none disabled:opacity-75" />
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-2">
                  <button onClick={() => void saveNote()} disabled={noteLocked} className="h-9 px-3 rounded-[12px] bg-[#EEF2F7] text-[#0F172A] text-xs font-bold hover:bg-slate-200 cursor-pointer disabled:opacity-50">Save note</button>
                  <button onClick={() => void lockNote()} disabled={noteLocked} className="h-9 px-4 rounded-[12px] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-white" style={{ backgroundColor: '#0F3A53' }}><Lock className="h-3.5 w-3.5" /><span>{noteLocked ? 'Locked' : 'Sign & lock'}</span></button>
                </div>
              </div>
            ) : null}
          </main>

          <footer className="relative h-[80px] flex items-center justify-center">
            <div className="bg-[#172130]/90 backdrop-blur-xl border border-white/10 rounded-[22px] p-[12px_14px] flex items-center gap-5 shadow-[0_24px_60px_rgba(0,0,0,.5)]">
              <div className="flex items-center gap-3">
                {[{ label: 'MUTE', icon: muted ? MicOff : Mic, active: muted, onClick: () => setMuted(!muted) }, { label: 'CAMERA', icon: videoOff ? VideoOff : Video, active: videoOff, onClick: () => setVideoOff(!videoOff) }, { label: 'SHARE', icon: Monitor, active: screenSharing, onClick: () => setScreenSharing(!screenSharing) }, { label: 'NOTES', icon: FileText, active: drawerOpen, onClick: () => setDrawerOpen(!drawerOpen) }].map((btn) => { const Icon = btn.icon; return <div key={btn.label} className="flex flex-col items-center gap-1 w-[74px]"><button onClick={btn.onClick} className={`h-[52px] w-[52px] rounded-[16px] flex items-center justify-center transition-all cursor-pointer ${btn.active ? 'bg-[#E3B341] text-[#0F172A] shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'}`}><Icon className="h-5 w-5" /></button><span className="text-[10px] font-black tracking-[0.08em] text-slate-400 uppercase">{btn.label}</span></div>; })}
              </div>
              <div className="h-[44px] w-[1px] bg-white/10" />
              <button onClick={() => setShowEndModal(true)} className="h-[52px] px-6 rounded-[16px] bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold text-[14.5px] flex items-center gap-2 shadow-[0_10px_26px_rgba(225,29,72,.4)] cursor-pointer whitespace-nowrap"><PhoneOff className="h-4 w-4" /><span>End session</span></button>
            </div>
          </footer>

          {showEndModal ? <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-6 z-50"><div className="w-full max-w-[440px] bg-[#1E293B] text-white rounded-[24px] p-6 shadow-2xl space-y-4 border border-slate-700"><h3 className="text-lg font-bold">End Telehealth Session?</h3><p className="text-xs text-slate-300 mt-1">This disconnects the call placeholder and takes you back to the client record.</p><div className="flex items-center gap-3 pt-2"><button onClick={() => setShowEndModal(false)} className="flex-1 h-11 rounded-[14px] bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700">Cancel</button><button onClick={() => navigate('/dashboard/clients')} className="flex-1 h-11 rounded-[14px] bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer">End session</button></div></div></div> : null}
        </>
      )}
    </div>
  );
}
