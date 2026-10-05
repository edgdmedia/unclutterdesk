import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, IdCard, LogOut, Loader2 } from 'lucide-react';
import { useBrand, type SidebarMode } from '@unclutterdesk/ui';
import { useAuth } from '../../context/AuthContext';
import { initialsOf } from '../../utils/initials';

/** POR-03: the client's account menu — My details and Sign out. */
export function ClientAccountMenu({ mode }: { mode: SidebarMode }) {
  const compact = mode === 'rail';
  const brand = useBrand();
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/portal', { replace: true });
    } finally {
      setLoggingOut(false);
      setOpen(false);
    }
  };

  const name = profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email : brand.name;
  const initials = initialsOf(name, 'CL');
  const MENU_ITEM = 'w-full flex items-center gap-2.5 px-3 h-[38px] rounded-[10px] text-[13.5px] font-semibold text-[#CBD5E1] hover:text-white hover:bg-[#334155] cursor-pointer';

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? `Account: ${name}` : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2.5 rounded-[12px] cursor-pointer ${compact ? 'mx-auto' : 'w-full'}`}
      >
        <div className="h-8 w-8 rounded-[10px] bg-[#1B5375] text-white flex items-center justify-center font-extrabold text-xs shrink-0 border border-white/10">
          {initials}
        </div>
        {compact ? null : (
          <>
            <div className="truncate text-left min-w-0">
              <p className="text-[12.5px] font-semibold text-[#E2E8F0] truncate leading-snug">{name}</p>
              <p className="text-[10px] text-[#64748B] font-medium leading-none">{profile?.email}</p>
            </div>
            <ChevronDown className={`ml-auto h-4 w-4 text-[#64748B] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>
      {open ? (
        <div
          role="menu"
          className={`absolute bottom-full mb-2 rounded-[14px] bg-[#1E293B] border border-white/10 shadow-2xl p-1.5 space-y-0.5 z-50 ${compact ? 'left-0 w-[220px]' : 'left-0 right-0'}`}
        >
          <Link to="/portal/details" role="menuitem" onClick={() => setOpen(false)} className={MENU_ITEM}>
            <IdCard className="h-4 w-4 shrink-0" />
            <span className="truncate">My details</span>
          </Link>
          <div className="h-px bg-white/10 my-1.5" />
          <button type="button" role="menuitem" onClick={() => void handleSignOut()} disabled={loggingOut} className="w-full flex items-center gap-2.5 px-3 h-[38px] rounded-[10px] text-[13px] font-semibold text-[#E11D48] hover:bg-[#E11D48]/10 disabled:opacity-50 cursor-pointer">
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <LogOut className="h-4 w-4 shrink-0" />}
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
