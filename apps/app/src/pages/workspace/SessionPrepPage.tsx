import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Video } from 'lucide-react';
import { Eyebrow } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';

type PrepPayload = {
  booking: {
    id: string;
    clientName: string;
    clientEmail: string;
    startsAt: string;
    endsAt: string;
    serviceTitle: string;
    status: string;
    videoRoomLink: string | null;
  };
  latestNote: {
    subjective?: string | null;
    objective?: string | null;
    assessment?: string | null;
    plan?: string | null;
    createdAt: string;
  } | null;
  submissions: Array<{
    id: string;
    formTitle: string;
    targetType: string;
    status: string;
    derived?: {
      instrument: 'PHQ_9' | 'GAD_7';
      totalScore: number;
      severity: string;
      item9Risk: boolean;
    } | null;
    submittedAt: string;
    answers: Array<{ key: string; value: unknown }>;
  }>;
  nextBooking: {
    clientName: string;
    startsAt: string;
    endsAt: string;
  } | null;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function SessionPrepPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [prep, setPrep] = useState<PrepPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function loadPrep() {
      setLoading(true);
      try {
        const data = await api.get<PrepPayload>(`/v1/consult/therapist/bookings/${id}/prep`);
        if (!cancelled) setPrep(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load session prep');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPrep();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[70px] shrink-0 bg-white border-b border-[#E2E8F0] px-[24px] flex items-center gap-4">
          <button onClick={() => navigate('/dashboard/schedule')} className="h-[40px] px-4 rounded-[13px] bg-white border border-[#E2E8F0] text-[#334155] text-[13px] font-bold flex items-center gap-2 hover:bg-[#F1F5F9] cursor-pointer">
            <ArrowLeft className="h-4 w-4" /> Back to schedule
          </button>
        </header>

        <main className="flex-1 min-h-0 overflow-auto p-[24px_26px_32px] grid grid-cols-[minmax(0,1fr)_340px] gap-[20px] items-start">
          {loading ? <div className="rounded-[24px] border border-[#E2E8F0] bg-white px-6 py-10 text-sm font-medium text-[#64748B]">Loading session prep...</div> : error || !prep ? <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error || 'Session prep unavailable'}</div> : (
            <>
              <div className="flex flex-col gap-4">
                <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px] flex items-center gap-5">
                  <div className="w-[72px] h-[72px] rounded-[24px] text-[#E3B341] font-extrabold text-[22px] flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#0F3A53,#1B5375)' }}>
                    {prep.booking.clientName.split(' ').slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Eyebrow>{formatDateTime(prep.booking.startsAt)} — {prep.booking.serviceTitle}</Eyebrow>
                    <h2 className="mt-1 text-[24px] font-bold tracking-[-0.02em] text-[#0F172A]">{prep.booking.clientName}</h2>
                    <p className="text-[13px] text-[#64748B] font-medium">{prep.booking.clientEmail}</p>
                  </div>
                  {prep.booking.videoRoomLink ? (
                    <a href={prep.booking.videoRoomLink} target="_blank" rel="noreferrer" className="h-[52px] px-6 rounded-[16px] bg-[#0F3A53] text-white font-bold text-[14px] flex items-center gap-2 shadow-[0_8px_22px_rgba(15,58,83,0.24)] hover:bg-[#0C2E42] cursor-pointer">
                      <Video className="h-4 w-4" /> Join secure video room
                    </a>
                  ) : (
                    <button disabled className="h-[52px] px-6 rounded-[16px] bg-[#E2E8F0] text-[#94A3B8] font-bold text-[14px] flex items-center gap-2 cursor-not-allowed">
                      <Video className="h-4 w-4" /> No video link yet
                    </button>
                  )}
                </div>

                <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
                  <div className="flex items-center justify-between"><Eyebrow>WHERE YOU LEFT OFF</Eyebrow>{prep.latestNote ? <span className="text-[11.5px] text-[#94A3B8] font-medium">{formatDateTime(prep.latestNote.createdAt)}</span> : null}</div>
                  {prep.latestNote ? (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-[16px] bg-[#F8FAFC] shadow-[inset_0_0_0_1px_#E2E8F0] p-[14px_16px]"><span className="text-[10px] font-black tracking-[0.14em] uppercase text-[#94A3B8]">Subjective</span><p className="mt-2 text-[12.5px] text-[#475569] font-medium leading-relaxed">{prep.latestNote.subjective || 'No subjective note saved.'}</p></div>
                      <div className="rounded-[16px] bg-[#F8FAFC] shadow-[inset_0_0_0_1px_#E2E8F0] p-[14px_16px]"><span className="text-[10px] font-black tracking-[0.14em] uppercase text-[#94A3B8]">Plan</span><p className="mt-2 text-[12.5px] text-[#475569] font-medium leading-relaxed">{prep.latestNote.plan || 'No plan saved.'}</p></div>
                    </div>
                  ) : <div className="mt-4 text-sm text-[#64748B] font-medium">No previous clinical note found for this client yet.</div>}
                </div>

                <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
                  <div className="flex items-center justify-between"><Eyebrow>SUBMITTED BEFORE THIS SESSION</Eyebrow><span className="h-[22px] px-2.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[9.5px] font-black tracking-[0.06em] uppercase flex items-center">{prep.submissions.length} item{prep.submissions.length === 1 ? '' : 's'}</span></div>
                  {prep.submissions.length === 0 ? <div className="mt-4 text-sm text-[#64748B] font-medium">No intake or assessment submissions attached to this booking.</div> : (
                    <div className="mt-4 flex flex-col gap-3">
                      {prep.submissions.map((submission) => (
                        <div key={submission.id} className="rounded-[18px] border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
                          <div className="flex items-center justify-between gap-3"><div><div className="text-[13.5px] font-bold text-[#0F172A]">{submission.formTitle}</div><div className="text-[12px] text-[#94A3B8] font-medium">{submission.targetType} · {formatDateTime(submission.submittedAt)}</div></div><span className="text-[11px] font-bold text-[#0F3A53]">{submission.status}</span></div>
                          {submission.derived?.instrument === 'PHQ_9' || submission.derived?.instrument === 'GAD_7' ? (
                            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#FEF3C7] border border-[#E3B341]/40 px-3 py-1.5 text-[11px] font-bold text-[#92400E]">
                              <span>{submission.derived.instrument === 'PHQ_9' ? 'PHQ-9' : 'GAD-7'}</span>
                              <span>·</span>
                              <span>{submission.derived.totalScore}</span>
                              <span>{submission.derived.severity}</span>
                            </div>
                          ) : null}
                          <div className="mt-3 grid grid-cols-2 gap-3">{submission.answers.slice(0, 6).map((answer) => <div key={`${submission.id}_${answer.key}`} className="rounded-[12px] bg-white border border-[#E2E8F0] px-3 py-2 text-[12px] text-[#475569]"><strong className="text-[#0F172A]">{answer.key}:</strong> {String(answer.value)}</div>)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="bg-[#0F172A] rounded-[24px] p-[22px_24px] shadow-[0_14px_40px_rgba(15,23,42,0.22)]">
                  <span className="text-[9px] font-black tracking-[0.22em] uppercase text-[#E3B341] block">SECURE VIDEO ROOM</span>
                  <p className="mt-2 text-[12.5px] text-slate-300 font-medium leading-relaxed">This session runs on your practice's secure video provider. Open the room link to start — it opens in a new tab.</p>
                  {prep.booking.videoRoomLink ? (
                    <a href={prep.booking.videoRoomLink} target="_blank" rel="noreferrer" className="mt-4 w-full h-[44px] rounded-[13px] bg-[#E3B341] text-[#0F172A] text-[13px] font-extrabold flex items-center justify-center gap-2 hover:brightness-105 cursor-pointer">
                      <Video className="h-4 w-4" /> Open video room
                    </a>
                  ) : (
                    <div className="mt-4 w-full h-[44px] rounded-[13px] bg-white/10 text-slate-400 text-[13px] font-bold flex items-center justify-center gap-2">No video link available yet</div>
                  )}
                </div>

                {prep.nextBooking ? <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[22px_24px] shadow-[0_8px_26px_rgba(15,23,42,0.05)]"><Eyebrow>AFTER THIS</Eyebrow><div className="mt-3 text-[13.5px] font-bold text-[#0F172A]">{prep.nextBooking.clientName}</div><div className="text-[12px] text-[#94A3B8] font-medium">{formatDateTime(prep.nextBooking.startsAt)} — {formatDateTime(prep.nextBooking.endsAt)}</div></div> : null}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
