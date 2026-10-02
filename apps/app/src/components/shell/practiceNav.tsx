import {
  Activity, BarChart3, Bell, Calendar, CalendarClock, ClipboardCheck, ClipboardList, Clock, CreditCard, FileText,
  Home, IdCard, LayoutDashboard, MapPin, Palette, Settings, Tag, Users, type LucideIcon,
} from 'lucide-react';
import type { SidebarSection } from '@unclutterdesk/ui';

export interface NavProfile {
  role?: string | null;
  type?: string | null;
}

interface NavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Element id for the guided tour. */
  tourId?: string;
  tier?: 'pro' | 'clinic';
  /** Only for roles that see clients clinically (owner, admin, therapist). */
  clinicalOnly?: boolean;
}

const MAIN: NavEntry[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/schedule', label: 'Schedule', icon: Calendar },
  { href: '/dashboard/sessions', label: 'Sessions', icon: ClipboardList, tourId: 'nav-sessions' },
  { href: '/dashboard/clients', label: 'Clients', icon: Users, tourId: 'nav-clients' },
  { href: '/dashboard/assessments', label: 'Assessments', icon: Activity },
  { href: '/dashboard/hours', label: 'Hours log', icon: Clock, clinicalOnly: true },
  { href: '/dashboard/submissions', label: 'Submissions', icon: ClipboardCheck },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
];

// Full settings for practice owners and admins.
const OWNER_GROUPS: { label: string; items: NavEntry[] }[] = [
  {
    label: 'Client-facing',
    items: [
      { href: '/dashboard/settings/profile', label: 'Practice profile', icon: IdCard },
      { href: '/dashboard/settings/locations', label: 'Locations', icon: MapPin },
      { href: '/dashboard/settings/brand', label: 'Brand & booking page', icon: Palette, tier: 'pro' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/dashboard/settings/availability', label: 'Availability', icon: CalendarClock, tourId: 'nav-availability' },
      { href: '/dashboard/settings/services', label: 'Services & pricing', icon: Settings },
      { href: '/dashboard/settings/team', label: 'Team & staff', icon: Users, tier: 'clinic' },
      { href: '/dashboard/settings/subscription', label: 'Subscription', icon: CreditCard },
      { href: '/dashboard/settings/payouts', label: 'Payouts', icon: CreditCard, tourId: 'nav-payouts' },
      { href: '/dashboard/settings/forms', label: 'Forms', icon: FileText, tier: 'pro', tourId: 'nav-forms' },
      { href: '/dashboard/settings/discounts', label: 'Discounts & promos', icon: Tag, tier: 'pro' },
    ],
  },
];

// Therapists and receptionists manage their own availability only.
const OWN_AVAILABILITY: { label: string; items: NavEntry[] }[] = [
  { label: 'My settings', items: [{ href: '/dashboard/settings/availability', label: 'Availability', icon: CalendarClock, tourId: 'nav-availability' }] },
];

/** The phone's bottom bar; everything else is under "More". */
export const PRACTICE_BOTTOM_NAV: { href: string; label: string; icon: LucideIcon; tourId?: string }[] = [
  { href: '/dashboard', label: 'Today', icon: Home },
  { href: '/dashboard/schedule', label: 'Schedule', icon: Calendar },
  { href: '/dashboard/clients', label: 'Clients', icon: Users, tourId: 'nav-clients' },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
];

const PLAN_RANK: Record<string, number> = { starter: 0, pro: 1, clinic: 2 };

/** Whether a practice on `plan` has features tagged `tier`. */
export function planIncludes(plan: string | undefined, tier: string): boolean {
  return (PLAN_RANK[(plan || 'starter').toLowerCase()] ?? 0) >= (PLAN_RANK[tier.toLowerCase()] ?? 0);
}

const isRole = (p: NavProfile | null | undefined, role: string) =>
  [p?.role, p?.type].some((r) => String(r ?? '').toUpperCase() === role);

function settingsGroups(p: NavProfile | null | undefined) {
  if (isRole(p, 'OWNER') || isRole(p, 'ADMIN')) return OWNER_GROUPS;
  return OWN_AVAILABILITY;
}

function PlanTag({ tier }: { tier: 'pro' | 'clinic' }) {
  return (
    <span
      title={`Part of the ${tier === 'clinic' ? 'Clinic' : 'Pro'} plan`}
      className="h-[16px] px-1.5 rounded-[4px] text-[8.5px] font-extrabold flex items-center justify-center uppercase tracking-wider bg-[#1E293B] text-[#94A3B8] border border-white/5"
    >
      {tier}
    </span>
  );
}

/** The practice sidebar for this person: filtered by role, tagged by plan. */
export function practiceSections(profile: NavProfile | null | undefined, plan: string | undefined): SidebarSection[] {
  const receptionist = isRole(profile, 'RECEPTIONIST');
  const toItem = (e: NavEntry) => ({
    key: e.href,
    label: e.label,
    href: e.href,
    icon: <e.icon />,
    // Only for features outside the practice's plan, as an upgrade hint.
    badge: e.tier && !planIncludes(plan, e.tier) ? <PlanTag tier={e.tier} /> : undefined,
    tourId: e.tourId,
  });
  return [
    { key: 'main', groups: [{ key: 'main', items: MAIN.filter((e) => !e.clinicalOnly || !receptionist).map(toItem) }] },
    {
      key: 'practice',
      label: 'Practice',
      icon: <Settings className="h-3.5 w-3.5" />,
      collapsible: true,
      groups: settingsGroups(profile).map((g) => ({ key: g.label, label: g.label, items: g.items.map(toItem) })),
    },
  ];
}

/** The nav entry a path belongs to: Overview only on itself, otherwise the longest matching prefix. */
export function activeNavKey(pathname: string, hrefs: string[]): string | undefined {
  const path = pathname === '/' ? '/dashboard' : pathname.replace(/\/+$/, '') || '/';
  let best: string | undefined;
  for (const href of hrefs) {
    const match = href === '/dashboard' ? path === href : path === href || path.startsWith(`${href}/`);
    if (match && (!best || href.length > best.length)) best = href;
  }
  return best;
}
