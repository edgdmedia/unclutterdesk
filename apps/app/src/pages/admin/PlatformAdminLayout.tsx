import { useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Building2, ClipboardList, Inbox, LayoutDashboard, ShieldCheck, Ticket } from 'lucide-react';
import { AppShell, UnclutterMark, type SidebarSection } from '@unclutterdesk/ui';
import { RouterLink } from '../../components/shell/RouterLink';
import { AdminAccountMenu } from '../../components/shell/AdminAccountMenu';
import { activeNavKey } from '../../components/shell/practiceNav';

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/tenants', label: 'Tenants', icon: Building2 },
  { href: '/admin/invites', label: 'Invite codes', icon: Ticket },
  { href: '/admin/assessments', label: 'Assessment library', icon: ClipboardList },
  { href: '/admin/requests', label: 'Requests', icon: Inbox },
];

const COLLAPSED_KEY = 'unclutter_admin_sidebar_collapsed';

function readFlag(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeFlag(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* preference only */
  }
}

/**
 * The admin console rides the same shell as the practice app: the same
 * sidebar in all three modes, the same account-menu position. Only the
 * items and the account menu differ.
 */
export function PlatformAdminLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => readFlag(COLLAPSED_KEY) === '1');

  const sections: SidebarSection[] = useMemo(
    () => [
      {
        key: 'platform',
        label: 'Platform',
        icon: <ShieldCheck className="h-3.5 w-3.5" />,
        groups: [{ key: 'main', items: ADMIN_NAV.map((n) => ({ key: n.href, label: n.label, href: n.href, icon: <n.icon /> })) }],
      },
    ],
    [],
  );
  const activeKey = activeNavKey(location.pathname, ADMIN_NAV.map((n) => n.href));

  return (
    <AppShell
      sidebar={{
        sections,
        activeKey,
        LinkComponent: RouterLink,
        brand: (mode) => (
          <div className="flex items-center gap-2 min-w-0">
            <UnclutterMark size={28} showBadge={false} className="shrink-0 rounded-[9px]" />
            {mode === 'rail' ? null : (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-[16px] tracking-[-0.02em] text-[#F8FAFC] truncate">Unclutter Desk</span>
                <span className="h-[18px] px-2 rounded-full text-[9px] font-extrabold tracking-[0.08em] bg-[#E3B341] text-[#0F172A] flex items-center justify-center uppercase shrink-0">Admin</span>
              </div>
            )}
          </div>
        ),
        account: (mode) => <AdminAccountMenu mode={mode} />,
      }}
      collapsed={collapsed}
      onCollapsedChange={(next) => {
        setCollapsed(next);
        writeFlag(COLLAPSED_KEY, next ? '1' : '0');
      }}
      bottomNav={{
        items: [ADMIN_NAV[0], ADMIN_NAV[1], ADMIN_NAV[2]].map((n) => ({ key: n.href, label: n.label, href: n.href, icon: <n.icon strokeWidth={2.5} /> })),
        active: activeKey,
        LinkComponent: RouterLink,
      }}
    >
      <Outlet />
    </AppShell>
  );
}
