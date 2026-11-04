import React from 'react';
import { NavLink, Navigate, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { settingsTabsFor, type SettingsTab } from '../../../components/shell/practiceNav';
import { useEntitlements } from '../../../utils/entitlements';

/**
 * GEN-04: Settings is one page. What used to be a dozen sidebar links is a
 * grouped tab rail; the tab's content is the existing settings page, mounted
 * unchanged, at the same URL it always had. Staff see only the tabs that are
 * theirs; plan tags stay visible as an upgrade hint.
 * 
 * Some tabs (like "My profile") link to pages outside /dashboard/settings/.
 * Those use a regular Link and are not mounted as child routes.
 */
export function SettingsHub() {
  const { profile } = useAuth();
  const plan = useEntitlements();
  const tabs = settingsTabsFor(profile as never, plan);
  if (!tabs.length) return null;
  // Fixed group order per plan
  const groupOrder = ['You', 'Practice', 'Booking page', 'Money'];
  const groups = groupOrder.filter((g) => tabs.some((t) => t.group === g));

  // Split tabs: internal (under /dashboard/settings/) and external
  const internalTabs = tabs.filter((t) => t.href.startsWith('/dashboard/settings/'));
  const externalTabs = tabs.filter((t) => !t.href.startsWith('/dashboard/settings/'));

  return (
    <div className="flex-1 flex flex-col md:flex-row min-w-0">
      <aside className="hidden md:flex w-[216px] shrink-0 flex-col gap-4 border-r border-[var(--desk-border)] bg-white px-3 py-4 overflow-y-auto">
        {groups.map((group) => (
          <nav key={group} aria-label={group} className="flex flex-col gap-0.5">
            <span className="px-2.5 pb-1 text-[9px] font-black tracking-[0.16em] uppercase text-[var(--desk-text-subtle)]">{group}</span>
            {internalTabs.filter((t) => t.group === group).map((t) => <TabLink key={t.href} tab={t} />)}
            {externalTabs.filter((t) => t.group === group).map((t) => <ExternalTabLink key={t.href} tab={t} />)}
          </nav>
        ))}
      </aside>

      <div className="md:hidden flex gap-2 px-3 py-2 bg-white border-b border-[var(--desk-border)] overflow-x-auto">
        {internalTabs.map((t) => <TabLink key={t.href} tab={t} compact />)}
        {externalTabs.map((t) => <ExternalTabLink key={t.href} tab={t} compact />)}
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}

/** `/dashboard/settings` itself: owners land on Practice profile; others land on their first visible internal tab. */
export function SettingsIndex() {
  const { profile } = useAuth();
  const tabs = settingsTabsFor(profile as never);
  const internalTabs = tabs.filter((t) => t.href.startsWith('/dashboard/settings/'));
  const isOwner = [profile?.role, profile?.type].some((r) => String(r ?? '').toUpperCase() === 'OWNER');
  const practiceProfile = internalTabs.find((t) => t.href.endsWith('/profile'));
  const target = isOwner && practiceProfile ? 'profile' : internalTabs[0]?.href.replace('/dashboard/settings/', '') || 'profile';
  return <Navigate to={target} replace />;
}

function TabLink({ tab, compact }: { tab: SettingsTab; compact?: boolean }) {
  return (
    <NavLink
      to={tab.href}
      className={({ isActive }) =>
        [
          'flex items-center gap-2.5 rounded-[10px] text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 cursor-pointer',
          compact ? 'h-[34px] px-3 border' : 'h-[36px] px-2.5',
          isActive
            ? compact ? 'bg-[var(--desk-sidebar)] text-white border-[var(--desk-text)]' : 'bg-[var(--desk-surface-muted)] text-[var(--desk-text)]'
            : compact ? 'bg-white text-[var(--desk-text-body)] border-[var(--desk-border)]' : 'text-[var(--desk-text-body)] hover:bg-[var(--desk-surface)]',
        ].join(' ')
      }
    >
      <tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{tab.label}</span>
      {tab.badgeTier ? (
        <span className="h-[16px] px-1.5 ml-auto rounded-[4px] text-[8.5px] font-extrabold uppercase tracking-wider flex items-center bg-[var(--desk-surface-muted)] text-[var(--desk-text-muted)] border border-[var(--desk-border)]">
          {tab.badgeTier}
        </span>
      ) : null}
    </NavLink>
  );
}

function ExternalTabLink({ tab, compact }: { tab: SettingsTab; compact?: boolean }) {
  return (
    <Link
      to={tab.href}
      className={[
        'flex items-center gap-2.5 rounded-[10px] text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 cursor-pointer',
        compact ? 'h-[34px] px-3 border' : 'h-[36px] px-2.5',
        compact ? 'bg-white text-[var(--desk-text-body)] border-[var(--desk-border)]' : 'text-[var(--desk-text-body)] hover:bg-[var(--desk-surface)]',
      ].join(' ')}
    >
      <tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{tab.label}</span>
      {tab.badgeTier ? (
        <span className="h-[16px] px-1.5 ml-auto rounded-[4px] text-[8.5px] font-extrabold uppercase tracking-wider flex items-center bg-[var(--desk-surface-muted)] text-[var(--desk-text-muted)] border border-[var(--desk-border)]">
          {tab.badgeTier}
        </span>
      ) : null}
    </Link>
  );
}
