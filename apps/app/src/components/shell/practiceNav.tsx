import {
  BarChart3, Bell, Calendar, CalendarClock, ClipboardCheck, ClipboardList, CreditCard, FileText, Globe,
  Home, IdCard, LayoutDashboard, Mail, MapPin, Palette, Settings, UserCog, Users, type LucideIcon,
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
  clinicalOnly?: boolean;
}

// GEN-03: the menu in the order the founder signed off — a few meaningful
// groups instead of a wall of links. Hours log left for the avatar menu and
// Notifications for the header bell: the sidebar says where the work is,
// not where every page is.
const MAIN: NavEntry[] = [
  { href: '/dashboard', label: 'Today', icon: LayoutDashboard },
  { href: '/dashboard/schedule', label: 'Schedule', icon: Calendar },
  { href: '/dashboard/sessions', label: 'Sessions', icon: ClipboardList, tourId: 'nav-sessions' },
  { href: '/dashboard/clients', label: 'Clients', icon: Users, tourId: 'nav-clients' },
];

const FORMS: NavEntry[] = [
  { href: '/dashboard/submissions', label: 'Submissions', icon: ClipboardCheck },
  { href: '/dashboard/assessments', label: 'Assessments', icon: ClipboardList },
  { href: '/dashboard/settings/forms', label: 'Forms', icon: FileText, tier: 'pro', tourId: 'nav-forms' },
];

// One entry for the whole settings area; the page itself is the tab hub.
const SETTINGS: NavEntry[] = [
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const INSIGHTS: NavEntry[] = [
  { href: '/dashboard/analytics', label: 'Reports', icon: BarChart3 },
  // Money earns its own link: the tour and the payout alerts point here.
  { href: '/dashboard/settings/payouts', label: 'Payouts', icon: CreditCard, tourId: 'nav-payouts' },
];

/**
 * GEN-04: everything that used to be a dozen sidebar links is one page with
 * grouped tabs. The hub renders this list; routes stay flat and deep-linkable,
 * and each tab's old URL still works (the path IS the old path).
 */
export interface SettingsTab {
  href: string;
  label: string;
  icon: LucideIcon;
  group: string;
  /** Set when the tab sits outside the practice's plan — shown as a tag. */
  badgeTier?: 'pro' | 'clinic';
}

interface TabDefinition extends Omit<SettingsTab, 'badgeTier'> {
  tier?: 'pro' | 'clinic';
  ownerOnly?: boolean;
}

const SETTINGS_TABS: TabDefinition[] = [
  { href: '/dashboard/settings/profile', label: 'Practice profile', icon: IdCard, group: 'Practice', ownerOnly: true },
  { href: '/dashboard/settings/locations', label: 'Locations', icon: MapPin, group: 'Practice', ownerOnly: true },
  { href: '/dashboard/settings/brand', label: 'Brand & booking page', icon: Palette, group: 'Practice', tier: 'pro', ownerOnly: true },
  { href: '/dashboard/settings/availability', label: 'Availability', icon: CalendarClock, group: 'Booking' },
  { href: '/dashboard/settings/services', label: 'Services & pricing', icon: Settings, group: 'Booking', ownerOnly: true },
  { href: '/dashboard/settings/discounts', label: 'Discounts & promos', icon: BarChart3, group: 'Booking', tier: 'pro', ownerOnly: true },
  { href: '/dashboard/settings/domain', label: 'Custom domain', icon: Globe, group: 'Domain & email', tier: 'pro', ownerOnly: true },
  { href: '/dashboard/settings/notifications', label: 'Notifications', icon: Bell, group: 'Domain & email', ownerOnly: true },
  { href: '/dashboard/settings/sending-domain', label: 'Sending domain', icon: Mail, group: 'Domain & email', tier: 'pro', ownerOnly: true },
  { href: '/dashboard/settings/team', label: 'Team & staff', icon: Users, group: 'Team & billing', tier: 'clinic', ownerOnly: true },
  { href: '/dashboard/settings/subscription', label: 'Subscription', icon: CreditCard, group: 'Team & billing', ownerOnly: true },
  { href: '/dashboard/settings/account', label: 'Preferences', icon: UserCog, group: 'Team & billing' },
];

/** The phone's bottom bar; everything else is under "More". */
export const PRACTICE_BOTTOM_NAV: { href: string; label: string; icon: LucideIcon; tourId?: string }[] = [
  { href: '/dashboard', label: 'Today', icon: Home },
  { href: '/dashboard/schedule', label: 'Schedule', icon: Calendar },
  { href: '/dashboard/sessions', label: 'Sessions', icon: ClipboardList, tourId: 'nav-sessions' },
  { href: '/dashboard/clients', label: 'Clients', icon: Users, tourId: 'nav-clients' },
];

const PLAN_RANK: Record<string, number> = { starter: 0, pro: 1, clinic: 2 };

/** Whether a practice on `plan` has features tagged `tier`. */
export function planIncludes(plan: string | undefined, tier: string): boolean {
  return (PLAN_RANK[(plan || 'starter').toLowerCase()] ?? 0) >= (PLAN_RANK[tier.toLowerCase()] ?? 0);
}

const isRole = (p: NavProfile | null | undefined, role: string) =>
  [p?.role, p?.type].some((r) => String(r ?? '').toUpperCase() === role);

const isOwnerOrAdmin = (p: NavProfile | null | undefined) => isRole(p, 'OWNER') || isRole(p, 'ADMIN');

/**
 * The tabs this person sees. Staff manage their own availability and
 * preferences; the practice itself is the owner's to configure. Plan gating
 * stays visible (a tag, not a removal) so owners can see what they're on.
 */
export function settingsTabsFor(profile: NavProfile | null | undefined, plan?: string): SettingsTab[] {
  return SETTINGS_TABS
    .filter((t) => !t.ownerOnly || isOwnerOrAdmin(profile))
    .map(({ ownerOnly, tier, ...tab }) => ({
      ...tab,
      badgeTier: tier && plan && !planIncludes(plan, tier) ? tier : undefined,
    }));
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
      key: 'forms',
      label: 'Forms & assessments',
      icon: <ClipboardCheck className="h-3.5 w-3.5" />,
      collapsible: true,
      groups: [{ key: 'forms', items: FORMS.map(toItem) }],
    },
    { key: 'settings', groups: [{ key: 'settings', items: SETTINGS.map(toItem) }] },
    { key: 'insights', groups: [{ key: 'insights', items: INSIGHTS.map(toItem) }] },
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
