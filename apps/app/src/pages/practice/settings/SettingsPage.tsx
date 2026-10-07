import React from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { settingsTabsFor, type SettingsTab } from '../../../components/shell/practiceNav';

/**
 * GEN-04: Settings is one page. What used to be a dozen sidebar links is a
 * grouped tab rail; the tab's content is the existing settings page, mounted
 * unchanged, at the same URL it always had. Staff see only the tabs that are
 * theirs; plan tags stay visible as an upgrade hint.
 */
export function SettingsHub() {
  const { profile } = useAuth();
  const tabs = settingsTabsFor(profile as never, (profile as { plan?: string } | null)?.plan);
  if (!tabs.length) return null;
  const groups = [...new Set(tabs.map((t) => t.group))];

  return (
    <div className="flex-1 flex flex-col md:flex-row min-w-0">
      <aside className="hidden md:flex w-[216px] shrink-0 flex-col gap-4 border-r border-[#E2E8F0] bg-white px-3 py-4 overflow-y-auto">
        {groups.map((group) => (
          <nav key={group} aria-label={group} className="flex flex-col gap-0.5">
            <span className="px-2.5 pb-1 text-[9px] font-black tracking-[0.16em] uppercase text-[#94A3B8]">{group}</span>
            {tabs.filter((t) => t.group === group).map((t) => <TabLink key={t.href} tab={t} />)}
          </nav>
        ))}
      </aside>

      <div className="md:hidden flex gap-2 px-3 py-2 bg-white border-b border-[#E2E8F0] overflow-x-auto">
        {tabs.map((t) => <TabLink key={t.href} tab={t} compact />)}
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}

/** `/dashboard/settings` itself, and any tab that does not exist: first tab wins. */
export function SettingsIndex() {
  const { profile } = useAuth();
  const tabs = settingsTabsFor(profile as never, (profile as { plan?: string } | null)?.plan);
  const first = tabs[0];
  return <Navigate to={first ? first.href.replace('/dashboard/settings/', '') : 'profile'} replace />;
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
            ? compact ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-[#F1F5F9] text-[#0F172A]'
            : compact ? 'bg-white text-[#475569] border-[#E2E8F0]' : 'text-[#475569] hover:bg-[#F8FAFC]',
        ].join(' ')
      }
    >
      <tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{tab.label}</span>
      {tab.badgeTier ? (
        <span className="h-[16px] px-1.5 ml-auto rounded-[4px] text-[8.5px] font-extrabold uppercase tracking-wider flex items-center bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]">
          {tab.badgeTier}
        </span>
      ) : null}
    </NavLink>
  );
}
