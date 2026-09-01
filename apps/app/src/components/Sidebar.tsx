import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Users,
  BarChart3,
  Palette,
  IdCard,
  CreditCard,
  FileText,
  Bell,
  LogOut,
  Loader2,
  ClipboardCheck,
  UserCog,
  CalendarClock,
  Settings,
  ChevronDown,
  Tag,
  X,
} from 'lucide-react';
import { useBrand, UnclutterLockup } from '@unclutterdesk/ui';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  counter?: string;
  counterType?: 'gold' | 'neutral' | 'rose';
  tier?: 'pro' | 'clinic';
}

interface SidebarProps {
  plan?: string;
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/dashboard/schedule', label: 'Schedule', icon: Calendar },
  { to: '/dashboard/clients', label: 'Clients', icon: Users },
  { to: '/dashboard/submissions', label: 'Submissions', icon: ClipboardCheck },
  { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/dashboard/notifications', label: 'Notifications', icon: Bell },
];

const ACCOUNT_MENU_ITEMS: { to: string; label: string; icon: typeof IdCard }[] = [
  { to: '/dashboard/profile', label: 'My profile', icon: IdCard },
  { to: '/dashboard/settings/account', label: 'Account & preferences', icon: UserCog },
];

// Full settings visible to practice owners and admins only
const PRACTICE_GROUPS_OWNER: { label: string; items: NavItem[] }[] = [
  {
    label: 'Client-facing',
    items: [
      { to: '/dashboard/settings/profile', label: 'Practice profile', icon: IdCard },
      { to: '/dashboard/settings/brand', label: 'Brand & booking page', icon: Palette, tier: 'pro' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/dashboard/settings/availability', label: 'Availability', icon: CalendarClock },
      { to: '/dashboard/settings/services', label: 'Services & pricing', icon: Settings },
      { to: '/dashboard/settings/team', label: 'Team & staff', icon: Users, tier: 'clinic' },
      { to: '/dashboard/settings/subscription', label: 'Subscription', icon: CreditCard },
      { to: '/dashboard/settings/payouts', label: 'Payouts', icon: CreditCard },
      { to: '/dashboard/settings/forms', label: 'Forms & assessments', icon: FileText, tier: 'pro' },
      { to: '/dashboard/settings/discounts', label: 'Discounts & promos', icon: Tag, tier: 'pro' },
    ],
  },
];

// Therapists only manage their own availability
const PRACTICE_GROUPS_THERAPIST: { label: string; items: NavItem[] }[] = [
  {
    label: 'My settings',
    items: [
      { to: '/dashboard/settings/availability', label: 'Availability', icon: CalendarClock },
    ],
  },
];

// Receptionists can view their schedule availability — nothing else
const PRACTICE_GROUPS_RECEPTIONIST: { label: string; items: NavItem[] }[] = [
  {
    label: 'My settings',
    items: [
      { to: '/dashboard/settings/availability', label: 'Availability', icon: CalendarClock },
    ],
  },
];

function getPracticeGroups(profile: any): { label: string; items: NavItem[] }[] {
  const role = profile?.role?.toLowerCase();
  const type = profile?.type?.toLowerCase();
  if (role === 'owner' || role === 'admin' || type === 'admin') {
    return PRACTICE_GROUPS_OWNER;
  }
  if (type === 'receptionist') return PRACTICE_GROUPS_RECEPTIONIST;
  return PRACTICE_GROUPS_THERAPIST;
}

const PRACTICE_OPEN_KEY = 'unclutter_sidebar_practice_open';

function counterClasses(type: 'gold' | 'neutral' | 'rose'): string {
  if (type === 'rose') return 'bg-[#E11D48] text-white';
  if (type === 'gold') return 'bg-[var(--brand-secondary,#E3B341)] text-[#0F172A]';
  return 'bg-white/10 text-[#CBD5E1]';
}

function NavLinkItem({ item, indent = false, currentPlan = 'starter', collapsed = false }: { item: NavItem; indent?: boolean; currentPlan?: string; collapsed?: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/dashboard'}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `relative flex items-center h-[44px] ${
          collapsed 
            ? 'justify-center w-[44px] mx-auto px-0' 
            : indent ? 'pr-3 pl-[30px] gap-2.5' : 'px-3 gap-2.5'
        } rounded-[14px] text-[13.5px] font-semibold transition-all ${
          isActive ? 'text-white' : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E293B]'
        }`
      }
      style={({ isActive }) =>
        isActive
          ? {
              background: `linear-gradient(90deg, rgba(28,78,63,.92), rgba(46,122,99,.55))`,
              boxShadow: `inset 0 0 0 1px rgba(74,151,129,.30), 0 8px 24px rgba(20,58,47,.50)`,
            }
          : undefined
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[20px] bg-[#4A9781] rounded-r-[3px]" />
          )}
          <span className="relative flex-none flex">
            <Icon className={`h-[18px] w-[18px] ${isActive ? 'stroke-[#4A9781]' : 'stroke-current'}`} />
            {collapsed && item.counter && (
               <span className={`absolute -top-1.5 -right-2 min-w-[15px] h-[15px] rounded-full text-[9px] font-extrabold flex items-center justify-center px-[3px] border-[1.5px] border-[#0F172A] ${counterClasses(item.counterType ?? 'neutral')}`}>
                 {item.counter}
               </span>
            )}
          </span>
          {!collapsed && <span className="truncate">{item.label}</span>}
          {!collapsed && item.tier && (
            <span
              className={`ml-auto h-[16px] px-1.5 rounded-[4px] text-[8.5px] font-extrabold flex items-center justify-center uppercase tracking-wider ${
                (item.tier === 'pro' && currentPlan === 'starter') || (item.tier === 'clinic' && currentPlan !== 'clinic')
                  ? 'bg-[#1E293B] text-[#94A3B8] border border-white/5'
                  : 'bg-[var(--brand-secondary,#E3B341)] text-[#0F172A]'
              }`}
            >
              {item.tier}
            </span>
          )}
          {!collapsed && !item.tier && item.counter && (
            <span
              className={`ml-auto h-5 px-2 rounded-full text-[10.5px] font-extrabold flex items-center justify-center ${counterClasses(item.counterType ?? 'neutral')}`}
            >
              {item.counter}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function UserMenuLink({
  to,
  icon: Icon,
  label,
  onNavigate,
}: {
  to: string;
  icon: typeof IdCard;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="flex items-center gap-2.5 px-3 h-[38px] rounded-[10px] text-[13.5px] font-semibold text-[#CBD5E1] hover:text-white hover:bg-[#334155]"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar({ plan = 'starter', isOpen, onClose, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const brand = useBrand();
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(
    () => localStorage.getItem(PRACTICE_OPEN_KEY) !== '0',
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const practiceGroups = getPracticeGroups(profile);
  const userMenuRef = useRef<HTMLDivElement>(null);

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
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const displayName = profile
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email
    : brand.name;
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w.charAt(0).toUpperCase())
    .join('');

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 transform transition-all duration-300 md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} min-h-screen os-sidebar text-white flex flex-col justify-between select-none shrink-0 border-r border-slate-800/50`}
        style={{ width: isCollapsed ? 76 : 248, padding: isCollapsed ? '20px 10px' : '20px 14px' }}
      >
        <div className="space-y-6">
          {/* Brand Lockup */}
          <div className={`px-2 py-1 mb-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            {isCollapsed ? (
              <UnclutterLockup variant="dark" showText={false} markSize={30} />
            ) : (
              brand.logoUrl ? (
                <div className="flex items-center gap-2.5">
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    className="h-7 w-7 rounded-[9px] object-cover border border-white/10"
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[17px] tracking-[-0.02em] text-[#F8FAFC] truncate max-w-[120px]">
                      {brand.name.toLowerCase()}
                    </span>
                    <span className="h-[18px] px-2 rounded-full text-[9px] font-extrabold tracking-[0.08em] bg-[#E3B341] text-[#0F172A] flex items-center justify-center uppercase shrink-0">
                      OS
                    </span>
                  </div>
                </div>
              ) : (
                <UnclutterLockup variant="dark" markSize={32} />
              )
            )}
            {/* Mobile Close Button */}
            {!isCollapsed && <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white p-1 cursor-pointer">
              <X className="h-5 w-5" />
            </button>}
          </div>

        {/* Navigation Links */}
        <nav className={`space-y-1 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
          {NAV_ITEMS.map((item) => (
            <NavLinkItem key={item.to} item={item} currentPlan={plan} collapsed={isCollapsed} />
          ))}

          {!isCollapsed && (
            <button
              type="button"
              aria-expanded={practiceOpen}
              onClick={() => {
                setPracticeOpen((v) => {
                  const next = !v;
                  localStorage.setItem(PRACTICE_OPEN_KEY, next ? '1' : '0');
                  return next;
                });
              }}
              className="w-full flex items-center gap-2 text-[9px] font-black tracking-[0.2em] uppercase text-[#475569] hover:text-[#94A3B8] px-3 pb-2 pt-5 transition-colors cursor-pointer"
            >
              <Settings className="h-3.5 w-3.5" />
              Practice
              <ChevronDown
                className={`ml-auto h-3.5 w-3.5 transition-transform duration-200 ${
                  practiceOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          )}
          {practiceOpen && !isCollapsed && (
            <div className="space-y-1">
              {practiceGroups.map((group) => (
                <div key={group.label} className="space-y-1">
                  <div className="text-[9px] font-black tracking-[0.2em] uppercase text-[#475569] pl-[30px] pt-3 pb-1">
                    {group.label}
                  </div>
                  {group.items.map((item) => (
                    <NavLinkItem key={item.to} item={item} indent currentPlan={plan} />
                  ))}
                </div>
              ))}
            </div>
          )}
          {isCollapsed && (
             <NavLinkItem 
               item={{ to: '/dashboard/settings/profile', label: 'Settings', icon: Settings }} 
               collapsed={true} 
             />
          )}

          {/* Toggle Collapse */}
          {onToggleCollapse && (
            <button
              type="button"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={onToggleCollapse}
              className={`mt-2 flex items-center ${isCollapsed ? 'justify-center w-[44px]' : 'justify-start w-full px-3'} h-[36px] gap-2.5 rounded-[12px] border-none cursor-pointer bg-transparent hover:bg-[#1E293B] text-[#94A3B8] text-[12.5px] font-semibold transition-colors mx-auto`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <path d={isCollapsed ? 'M15 4v16M10 10l-2 2 2 2' : 'M9 4v16M15 10l2 2-2 2'} />
              </svg>
              {!isCollapsed && 'Collapse'}
            </button>
          )}
        </nav>
      </div>

      {/* Sidebar Footer: user menu */}
      <div ref={userMenuRef} className={`relative ${isCollapsed ? 'pt-3.5 border-t border-white/[0.07] px-0 flex justify-center' : 'pt-3.5 border-t border-white/[0.07] px-2'}`}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className={`flex items-center gap-2.5 rounded-[12px] cursor-pointer ${isCollapsed ? 'w-auto' : 'w-full'}`}
        >
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={displayName}
              className={`${isCollapsed ? 'h-8 w-8' : 'h-8 w-8'} rounded-[10px] object-cover shrink-0 border border-white/10`}
            />
          ) : (
            <div className={`${isCollapsed ? 'h-8 w-8' : 'h-8 w-8'} rounded-[10px] bg-[#1B5375] text-white flex items-center justify-center font-extrabold text-xs shrink-0 border border-white/10`}>
              {initials}
            </div>
          )}
          {!isCollapsed && (
            <>
              <div className="truncate text-left">
                <p className="text-[12.5px] font-semibold text-[#E2E8F0] truncate leading-snug">{displayName}</p>
                <p className="text-[10px] text-[#64748B] font-medium leading-none">
                  {profile?.type === 'admin' ? 'Administrator'
                    : profile?.type === 'therapist' ? 'Therapist'
                    : profile?.type === 'receptionist' ? 'Receptionist'
                    : brand.name}
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
            className={`absolute bottom-full mb-2 rounded-[14px] bg-[#1E293B] border border-white/10 shadow-2xl p-1.5 space-y-0.5 z-50 ${isCollapsed ? 'left-4 w-[200px]' : 'left-0 right-0'}`}
          >
            {ACCOUNT_MENU_ITEMS.map((item) => (
              <UserMenuLink
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                onNavigate={() => setMenuOpen(false)}
              />
            ))}
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
        )}
      </div>
    </aside>
    </>
  );
}
