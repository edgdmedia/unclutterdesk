import { useMemo, useState, type ReactNode } from 'react';
import { useEntitlements } from '../../utils/entitlements';
import { useLocation } from 'react-router-dom';
import { AppShell } from '@unclutterdesk/ui';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '../../context/AuthContext';
import { activeNavKey, bottomNavFor, practiceSections } from './practiceNav';
import { RouterLink } from './RouterLink';
import { AccountMenu } from './AccountMenu';
import { PracticeBrand } from './PracticeBrand';

const COLLAPSED_KEY = 'unclutter_sidebar_collapsed';
// Each collapsible section remembers whether it was left open: forms, booking, …
const sectionOpenKey = (key: string) => `unclutter_sidebar_${key}_open`;

// Storage can be unavailable (private windows, blocked site data); the shell must still work.
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

export function PracticeShell({ banner, children }: { banner?: ReactNode; children: ReactNode }) {
  const { profile } = useAuth();
  const plan = useEntitlements();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => readFlag(COLLAPSED_KEY) === '1');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => ({
    forms: readFlag(sectionOpenKey('forms')) !== '0',
    booking: readFlag(sectionOpenKey('booking')) !== '0',
  }));

  const sections = useMemo(() => practiceSections(profile, plan), [profile, plan]);
  const hrefs = useMemo(
    () => [...sections.flatMap((s) => s.groups.flatMap((g) => g.items.map((i) => i.href))), ...bottomNavFor(profile).map((i) => i.href)],
    [sections, profile],
  );
  const activeKey = activeNavKey(location.pathname, hrefs);

  return (
    <AppShell
      sidebar={{
        sections,
        activeKey,
        LinkComponent: RouterLink,
        brand: (mode) => <PracticeBrand mode={mode} />,
        account: (mode) => <AccountMenu mode={mode} />,
        openSections,
        onSectionToggle: (key, open) => {
          setOpenSections((prev) => ({ ...prev, [key]: open }));
          writeFlag(sectionOpenKey(key), open ? '1' : '0');
        },
      }}
      collapsed={collapsed}
      onCollapsedChange={(next) => {
        setCollapsed(next);
        writeFlag(COLLAPSED_KEY, next ? '1' : '0');
      }}
      bottomNav={{
        items: bottomNavFor(profile).map((i) => ({ key: i.href, label: i.label, href: i.href, icon: <i.icon strokeWidth={2.5} /> })),
        active: activeKey,
        LinkComponent: RouterLink,
      }}
      banner={banner}
      header={<NotificationBell allHref="/dashboard/notifications" />}
    >
      {children}
    </AppShell>
  );
}
