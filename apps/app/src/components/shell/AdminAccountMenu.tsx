import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, LogOut } from 'lucide-react';
import type { SidebarMode } from '@unclutterdesk/ui';
import { useAuth } from '../../context/AuthContext';

const MENU_ITEM = 'w-full flex items-center gap-2.5 px-3 h-[38px] rounded-[10px] text-[13.5px] font-semibold text-[#CBD5E1] hover:text-white hover:bg-[#334155] cursor-pointer';

/**
 * The admin console's account menu: same shape as the practice one, with the
 * two things an operator can do — go back to their own practice, or sign out.
 */
export function AdminAccountMenu({ mode }: { mode: SidebarMode }) {
  const compact = mode === 'rail';
  const { profile, logout, switchToPractice } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const displayName = profile?.email || 'Platform Admin';
  const initials = displayName
    .split('@')[0]
    .split(/[._-]/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || 'A';

  async function backToPractice() {
    setSwitching(true);
    try {
      await switchToPractice();
      // A full load, so nothing cached from the admin console carries over.
      window.location.assign('/dashboard');
    } catch {
      setSwitching(false);
    }
  }

  async function signOut() {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/admin/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? `Account: ${displayName}` : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2.5 rounded-[12px] cursor-pointer ${compact ? 'mx-auto' : 'w-full'}`}
      >
        <div className="h-8 w-8 rounded-[10px] bg-[#1B5375] text-white flex items-center justify-center font-extrabold text-xs shrink-0 border border-white/10">
          {initials}
        </div>
        {compact ? null : (
          <>
            <div className="truncate text-left min-w-0">
              <p className="text-[12.5px] font-semibold text-[#E2E8F0] truncate leading-snug">{displayName}</p>
              <p className="text-[10px] text-[#E3B341] font-bold uppercase tracking-wide">{profile?.platformRole || 'Admin'}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={`ml-auto h-4 w-4 text-[#64748B] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className={`absolute bottom-full mb-2 rounded-[14px] bg-[#1E293B] border border-white/10 shadow-2xl p-1.5 space-y-0.5 z-50 ${compact ? 'left-0 w-[220px]' : 'left-0 right-0'}`}
        >
          {profile?.hasPractice ? (
            <button type="button" disabled={switching} onClick={() => void backToPractice()} className={MENU_ITEM}>
              {switching ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <ArrowLeft className="h-4 w-4 shrink-0" />}
              Back to my practice
            </button>
          ) : null}
          {profile?.hasPractice ? <div className="h-px bg-white/10 my-1.5" /> : null}
          <button
            type="button"
           
            onClick={() => void signOut()}
            disabled={loggingOut}
            className="w-full flex items-center gap-2.5 px-3 h-[38px] rounded-[10px] text-[13px] font-semibold text-[#E11D48] hover:bg-[#E11D48]/10 disabled:opacity-50 cursor-pointer"
          >
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <LogOut className="h-4 w-4 shrink-0" />}
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
