import { useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AppShell, useBrand } from '@unclutterdesk/ui';
import { useAuth } from '../../context/AuthContext';
import { PracticeLogo } from '../public/PracticeLogo';
import { PortalDataProvider, usePortalData } from '../../pages/client/portal/PortalDataContext';
import { PortalSignIn } from '../../pages/client/portal/PortalSignIn';
import { CLIENT_BOTTOM_NAV, CLIENT_NAV, clientSections } from './clientNav';
import { activeNavKey } from './practiceNav';
import { RouterLink } from './RouterLink';
import { ClientAccountMenu } from './ClientAccountMenu';
import { NotificationBell } from './NotificationBell';

const HREFS = CLIENT_NAV.map((i) => i.href);

/**
 * POR-03: the portal in the same frame as the practice and admin apps, in the
 * practice's brand. Signed out there is no frame at all: only the sign-in card,
 * so the page can never claim both states at once (POR-06).
 */
export function ClientShell({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <PortalSignIn />;
  return (
    <PortalDataProvider>
      <ClientFrame>{children}</ClientFrame>
    </PortalDataProvider>
  );
}

function ClientFrame({ children }: { children: ReactNode }) {
  const brand = useBrand();
  const { formsTodo } = usePortalData();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('client-sidebar-collapsed') === '1');
  const sections = useMemo(() => clientSections(formsTodo ?? undefined), [formsTodo]);
  const activeKey = activeNavKey(location.pathname, HREFS);

  return (
    <AppShell
      sidebar={{
        sections,
        activeKey,
        LinkComponent: RouterLink,
        brand: (mode) => (
          <div className="flex items-center gap-2.5 min-w-0">
            <PracticeLogo name={brand.name || 'Unclutter Desk'} logoUrl={brand.logoUrl} size={mode === 'rail' ? 32 : 36} color={brand.primaryColor || '#0F3A53'} />
            {mode !== 'rail' ? <span className="truncate text-[14.5px] font-bold text-[#0F172A]">{brand.name}</span> : null}
          </div>
        ),
        account: (mode) => <ClientAccountMenu mode={mode} />,
      }}
      collapsed={collapsed}
      onCollapsedChange={(next) => {
        setCollapsed(next);
        localStorage.setItem('client-sidebar-collapsed', next ? '1' : '0');
      }}
      bottomNav={{
        items: CLIENT_BOTTOM_NAV.map((i) => ({ key: i.href, label: i.label, href: i.href, icon: <i.icon strokeWidth={2.5} /> })),
        active: activeKey,
        LinkComponent: RouterLink,
      }}
      header={<NotificationBell allHref="/portal/notifications" />}
    >
      {children}
    </AppShell>
  );
}
