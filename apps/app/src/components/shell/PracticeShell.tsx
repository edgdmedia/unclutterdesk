import { useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AppShell } from '@unclutterdesk/ui';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '../../context/AuthContext';
import { PRACTICE_BOTTOM_NAV, activeNavKey, practiceSections } from './practiceNav';
import { RouterLink } from './RouterLink';
import { AccountMenu } from './AccountMenu';
import { PracticeBrand } from './PracticeBrand';

const COLLAPSED_KEY = 'unclutter_sidebar_collapsed';
const PRACTICE_OPEN_KEY = 'unclutter_sidebar_practice_open';

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

export function PracticeShell({ plan, banner, children }: { plan?: string; banner?: ReactNode; children: ReactNode }) {
  const { profile } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => readFlag(COLLAPSED_KEY) === '1');
  const [practiceOpen, setPracticeOpen] = useState(() => readFlag(PRACTICE_OPEN_KEY) !== '0');

  const sections = useMemo(() => practiceSections(profile, plan), [profile, plan]);
  const hrefs = useMemo(
    () => [...sections.flatMap((s) => s.groups.flatMap((g) => g.items.map((i) => i.href))), ...PRACTICE_BOTTOM_NAV.map((i) => i.href)],
    [sections],
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
        openSections: { practice: practiceOpen },
        onSectionToggle: (key, open) => {
          if (key !== 'practice') return;
          setPracticeOpen(open);
          writeFlag(PRACTICE_OPEN_KEY, open ? '1' : '0');
        },
      }}
      collapsed={collapsed}
      onCollapsedChange={(next) => {
        setCollapsed(next);
        writeFlag(COLLAPSED_KEY, next ? '1' : '0');
      }}
      bottomNav={{
        items: PRACTICE_BOTTOM_NAV.map((i) => ({ key: i.href, label: i.label, href: i.href, icon: <i.icon strokeWidth={2.5} /> })),
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
