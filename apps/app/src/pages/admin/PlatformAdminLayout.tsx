import React, { useRef, useState, useEffect } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  LogOut,
  Loader2,
  ChevronDown,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AdminNavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/tenants', label: 'Tenants', icon: Building2 },
];

function AdminNavLink({ item, isCollapsed }: { item: AdminNavItem; isCollapsed?: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={isCollapsed ? item.label : undefined}
      className={({ isActive }) =>
        `relative flex items-center h-[44px] ${isCollapsed ? 'justify-center w-[44px] mx-auto px-0' : 'gap-2.5 px-3'} rounded-[14px] text-[13.5px] font-semibold transition-all ${
          isActive
            ? 'text-white bg-[#0F3A53] shadow-[0_8px_24px_rgba(15,58,83,0.45),inset_0_0_0_1px_rgba(227,179,65,0.28)]'
            : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E293B]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !isCollapsed && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[20px] bg-[#E3B341] rounded-r-[3px]" />
          )}
          <span className="relative flex-none flex">
            <Icon className={`h-[18px] w-[18px] ${isActive ? 'stroke-[#E3B341]' : 'stroke-current'}`} />
          </span>
          {!isCollapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}

export function PlatformAdminLayout() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem('unclutter_admin_sidebar_collapsed') === '1'
  );
  const userMenuRef = useRef<HTMLDivElement>(null);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('unclutter_admin_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/admin/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const displayName = profile?.email || 'Platform Admin';
  const initials = displayName
    .split('@')[0]
    .split(/[._-]/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || 'A';

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <aside 
        className="hidden md:flex min-h-screen bg-[#0F172A] text-white flex-col justify-between select-none shrink-0 border-r border-slate-800/50 transition-all duration-300"
        style={{ width: isCollapsed ? 76 : 248, padding: isCollapsed ? '20px 10px' : '20px 14px' }}
      >
        <div className="space-y-6">
          <div className={`px-2 py-1 mb-4 flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
            <div className="h-7 w-7 shrink-0 rounded-[9px] bg-[#0F3A53] text-[#E3B341] flex items-center justify-center font-extrabold text-sm border border-[#E3B341]/30 shadow-xs">
              O
            </div>
            {!isCollapsed && (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[17px] tracking-[-0.02em] text-[#F8FAFC] truncate">
                  Unclutter Desk
                </span>
                <span className="h-[18px] px-2 rounded-full text-[9px] font-extrabold tracking-[0.08em] bg-[#E3B341] text-[#0F172A] flex items-center justify-center uppercase shrink-0">
                  Admin
                </span>
              </div>
            )}
          </div>

          <nav className={`space-y-1 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
            {!isCollapsed && (
              <div className="flex items-center gap-2 px-3 pb-2 text-[9px] font-black tracking-[0.2em] uppercase text-[#475569]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Platform
              </div>
            )}
            {ADMIN_NAV.map((item) => (
              <AdminNavLink key={item.to} item={item} isCollapsed={isCollapsed} />
            ))}

            <Link
              to="/login"
              title={isCollapsed ? 'Back to practice' : undefined}
              className={`flex items-center h-[44px] ${isCollapsed ? 'justify-center w-[44px] mx-auto px-0' : 'gap-2.5 px-3'} rounded-[14px] text-[13.5px] font-semibold text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1E293B] transition-all`}
            >
              <ArrowLeft className="h-[18px] w-[18px] shrink-0" />
              {!isCollapsed && <span>Back to practice</span>}
            </Link>
            
            <button
              type="button"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={toggleCollapse}
              className={`mt-2 flex items-center ${isCollapsed ? 'justify-center w-[44px]' : 'justify-start w-full px-3'} h-[36px] gap-2.5 rounded-[12px] border-none cursor-pointer bg-transparent hover:bg-[#1E293B] text-[#94A3B8] text-[12.5px] font-semibold transition-colors mx-auto`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <path d={isCollapsed ? 'M15 4v16M10 10l-2 2 2 2' : 'M9 4v16M15 10l2 2-2 2'} />
              </svg>
              {!isCollapsed && 'Collapse'}
            </button>
          </nav>
        </div>

        <div ref={userMenuRef} className={`relative pt-3.5 border-t border-white/[0.07] ${isCollapsed ? 'px-0 flex justify-center' : 'px-2'}`}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex items-center gap-2.5 rounded-[12px] cursor-pointer ${isCollapsed ? 'w-auto' : 'w-full'}`}
          >
            <div className="h-8 w-8 shrink-0 rounded-[10px] bg-[#1B5375] text-white flex items-center justify-center font-extrabold text-xs border border-white/10">
              {initials}
            </div>
            {!isCollapsed && (
              <>
                <div className="truncate text-left">
                  <p className="text-[12.5px] font-semibold text-[#E2E8F0] truncate leading-snug">
                    {displayName}
                  </p>
                  <p className="text-[10px] text-[#E3B341] font-bold uppercase tracking-wide">
                    {profile?.platformRole || 'Admin'}
                  </p>
                </div>
                <ChevronDown
                  className={`ml-auto h-4 w-4 text-[#64748B] shrink-0 transition-transform duration-200 ${
                    menuOpen ? 'rotate-180' : ''
                  }`}
                />
              </>
            )}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute bottom-full left-0 right-0 mb-2 rounded-[14px] bg-[#1E293B] border border-white/10 shadow-2xl p-1.5 z-50"
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                disabled={loggingOut}
                className="w-full flex items-center gap-2.5 px-3 h-[38px] rounded-[10px] text-[13px] font-semibold text-[#E11D48] hover:bg-[#E11D48]/10 disabled:opacity-50 cursor-pointer"
              >
                {loggingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <LogOut className="h-4 w-4 shrink-0" />
                )}
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
