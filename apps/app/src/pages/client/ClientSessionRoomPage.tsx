import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useBrand } from '@unclutterdesk/ui';
import { PracticeLogo } from '../../components/public/PracticeLogo';
import { VideoStage } from '../../components/video/VideoStage';
import { api } from '../../utils/apiClient';
import { useAuth } from '../../context/AuthContext';

type PortalSession = { id: string; serviceTitle: string; startsAt: string; endsAt: string; therapistName: string };

const timeRange = (s: PortalSession) => {
  const f = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });
  const t = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });
  return `${f.format(new Date(s.startsAt))} – ${t.format(new Date(s.endsAt))}`;
};

/**
 * VID-01: the client's session room, on the practice's own address. The same
 * video stage as the therapist's room; Leave goes back to the portal. Who may
 * enter, and when, is the API's decision.
 */
export function ClientSessionRoomPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const brand = useBrand();
  const { isAuthenticated, isLoading } = useAuth() as { isAuthenticated: boolean; isLoading?: boolean };
  const [session, setSession] = useState<PortalSession | null>(null);
  const primary = brand.primaryColor || '#0F3A53';

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    api
      .get<{ upcoming: PortalSession[]; past: PortalSession[] }>('/v1/consult/portal')
      .then((p) => {
        if (!cancelled) setSession([...p.upcoming, ...p.past].find((s) => s.id === id) ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, id]);

  return (
    <div className="min-h-screen bg-[#0B1220] text-white font-outfit flex flex-col p-4 sm:p-6 gap-4">
      <header className="min-h-[66px] border border-white/10 rounded-[20px] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0" style={{ backgroundColor: primary }}>
        <div className="flex items-center gap-3 min-w-0">
          <PracticeLogo name={brand.name || 'Unclutter Desk'} logoUrl={brand.logoUrl} size={32} color="#E3B341" />
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold leading-tight truncate">
              {session ? `${session.serviceTitle} with ${session.therapistName}` : brand.name || 'Your session'}
            </h1>
            {session ? <p className="text-[11.5px] text-white/70">{timeRange(session)}</p> : null}
          </div>
        </div>
        <span className="h-[28px] px-3 rounded-full bg-white/10 text-white text-[10.5px] font-black tracking-wider uppercase border border-white/20 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Private room</span>
        </span>
      </header>

      <main className="flex-1 min-h-[520px]">
        {isLoading ? null : !isAuthenticated ? (
          <div className="mx-auto mt-10 max-w-[440px] rounded-[22px] bg-white text-[#0F172A] p-6 space-y-3">
            <h2 className="text-[16px] font-bold">Sign in to join your session</h2>
            <p className="text-[13px] text-[#64748B]">Use the email address you booked with. Your room is private to you and your therapist.</p>
            <Link to="/login" className="inline-flex h-[44px] px-5 rounded-[14px] text-white text-[13px] font-bold items-center" style={{ backgroundColor: primary }}>
              Sign in
            </Link>
          </div>
        ) : (
          <VideoStage bookingId={id} waitingFor={session?.therapistName ?? 'your therapist'} endLabel="Leave" onLeft={() => navigate('/portal')} />
        )}
      </main>
    </div>
  );
}
