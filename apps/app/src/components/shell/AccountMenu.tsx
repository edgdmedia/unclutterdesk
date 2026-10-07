import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CalendarClock, ChevronDown, Clock, Compass, IdCard, Loader2, LogOut, MessageSquarePlus, ShieldCheck, UserCog } from 'lucide-react';
import { useBrand, type SidebarMode } from '@unclutterdesk/ui';
import { useAuth } from '../../context/AuthContext';
import { AdminSwitchDialog } from '../AdminSwitchDialog';

const ACCOUNT_MENU_ITEMS = [
  { to: '/dashboard/profile', label: 'My profile', icon: IdCard },
  { to: '/dashboard/settings/availability', label: 'Availability', icon: CalendarClock },
  { to: '/dashboard/settings/account', label: 'Account & preferences', icon: UserCog },
  { to: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  // GEN-03: personal and clinical-only items live in the avatar menu now.
  { to: '/dashboard/hours', label: 'Hours log', icon: Clock, clinicalOnly: true },
  { to: '/dashboard/requests', label: 'Requests & feedback', icon: MessageSquarePlus },
];

const MENU_ITEM = 'w-full flex items-center gap-2.5 px-3 h-[38px] rounded-[10px] text-[13.5px] font-semibold text-[#CBD5E1] hover:text-white hover:bg-[#334155] cursor-pointer';

/** The Hours log is clinical work; a receptionist has no cases to log against. */
export function visibleAccountMenuItems(profile: { role?: string | null; type?: string | null } | null | undefined) {
  const isReceptionist = [profile?.role, profile?.type].some((r) => String(r ?? '').toUpperCase() === 'RECEPTIONIST');
  return ACCOUNT_MENU_ITEMS.filter((item) => !item.clinicalOnly || !isReceptionist);
}

export function AccountMenu({ mode }: { mode: SidebarMode }) {
  const compact = mode === 'rail';
  const brand = useBrand();
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [adminSwitchOpen, setAdminSwitchOpen] = useState(false);
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
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const displayName = profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email : brand.name;
  const initials = displayName.split(' ').slice(0, 2).map((w: string) => w.charAt(0).toUpperCase()).join('');
  const roleLabel =
    profile?.type === 'admin' ? 'Administrator' : profile?.type === 'therapist' ? 'Therapist' : profile?.type === 'receptionist' ? 'Receptionist' : brand.name;

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        data-tour="account-menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? `Account: ${displayName}` : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2.5 rounded-[12px] cursor-pointer ${compact ? 'mx-auto' : 'w-full'}`}
      >
        {profile?.avatarUrl ? (
          <img src={profile.avatarUrl} alt="" className="h-8 w-8 rounded-[10px] object-cover shrink-0 border border-white/10" />
        ) : (
          <div className="h-8 w-8 rounded-[10px] bg-[#1B5375] text-white flex items-center justify-center font-extrabold text-xs shrink-0 border border-white/10">
            {initials}
          </div>
        )}
        {compact ? null : (
          <>
            <div className="truncate text-left min-w-0">
              <p className="text-[12.5px] font-semibold text-[#E2E8F0] truncate leading-snug">{displayName}</p>
              <p className="text-[10px] text-[#64748B] font-medium leading-none">{roleLabel}</p>
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
          {visibleAccountMenuItems(profile).map((item) => (
            <Link key={item.to} to={item.to} role="menuitem" onClick={() => setOpen(false)} className={MENU_ITEM}>
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
          {profile?.platformAdmin ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setAdminSwitchOpen(true);
              }}
              className={MENU_ITEM}
            >
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Platform admin
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              // The tour lives on the dashboard, so go there first; the tour
              // itself also jumps back to /dashboard if this was elsewhere.
              navigate('/dashboard');
              setTimeout(() => window.dispatchEvent(new CustomEvent('unclutter:tour-start')), 100);
            }}
            className={MENU_ITEM}
          >
            <Compass className="h-4 w-4 shrink-0" />
            Take the tour
          </button>
          <div className="h-px bg-white/10 my-1.5" />
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={loggingOut}
            className="w-full flex items-center gap-2.5 px-3 h-[38px] rounded-[10px] text-[13px] font-semibold text-[#E11D48] hover:bg-[#E11D48]/10 disabled:opacity-50 cursor-pointer"
          >
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <LogOut className="h-4 w-4 shrink-0" />}
            Sign out
          </button>
        </div>
      ) : null}
      {adminSwitchOpen ? <AdminSwitchDialog onClose={() => setAdminSwitchOpen(false)} /> : null}
    </div>
  );
}
