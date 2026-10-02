import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Video } from 'lucide-react';
import { joinState, joinWindow } from '@unclutterdesk/shared';

const watTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });

const READY = 'h-[48px] px-5 rounded-[16px] bg-[#E3B341] text-[#0F172A] text-[13.5px] font-extrabold inline-flex items-center justify-center gap-2 shadow-[0_8px_22px_rgba(227,179,65,0.35)] hover:brightness-105 cursor-pointer';
const WAITING = 'h-[48px] px-5 rounded-[16px] bg-[#E2E8F0] text-[#64748B] text-[13.5px] font-extrabold inline-flex items-center justify-center gap-2 cursor-not-allowed';

/**
 * VID-02: the only Join button. Before the room opens it reads "Opens at
 * 9:45 AM" and does nothing; it becomes Join at that minute without a reload,
 * and disappears once the session is over. The server applies the same window.
 */
export function JoinButton({
  startsAt,
  endsAt,
  to,
  label = 'Join session',
  className = READY,
  waitingClassName = WAITING,
}: {
  startsAt: string;
  endsAt: string;
  to: string;
  label?: string;
  className?: string;
  waitingClassName?: string;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const state = joinState(now, start, end);
  if (state === 'over') return null;
  if (state === 'early') {
    return (
      <button type="button" disabled className={waitingClassName}>
        <Video className="h-4 w-4" />
        {`Opens at ${watTime(joinWindow(start, end).opensAt)}`}
      </button>
    );
  }
  return (
    <Link to={to} className={className}>
      <Video className="h-4 w-4" />
      {label}
    </Link>
  );
}
