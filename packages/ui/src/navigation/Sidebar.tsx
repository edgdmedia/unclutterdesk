import { useEffect, useRef, type ReactNode } from 'react';
import { PlainLink, type LinkLike } from './links';
import { useFocusTrap } from '../a11y/useFocusTrap';

export interface SidebarItem {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  /** Shown after the label in full mode, e.g. a plan tag. */
  badge?: ReactNode;
}
export interface SidebarGroup {
  key: string;
  label?: string;
  items: SidebarItem[];
}
export interface SidebarSection {
  key: string;
  label?: string;
  icon?: ReactNode;
  collapsible?: boolean;
  groups: SidebarGroup[];
}
export type SidebarMode = 'full' | 'rail' | 'overlay';

export interface SidebarProps {
  sections: SidebarSection[];
  activeKey?: string;
  mode: SidebarMode;
  brand: (mode: SidebarMode) => ReactNode;
  account?: (mode: SidebarMode) => ReactNode;
  LinkComponent?: LinkLike;
  openSections?: Record<string, boolean>;
  onSectionToggle?: (key: string, open: boolean) => void;
  onToggleCollapse?: () => void;
  onClose?: () => void;
  onNavigate?: () => void;
}

const ITEM_BASE = 'relative flex items-center h-[44px] rounded-[14px] text-[13.5px] font-semibold transition-all';
const ITEM_IDLE = 'text-[var(--desk-text-subtle)] hover:text-[var(--desk-border)] hover:bg-[var(--desk-sidebar-hover)]';
// The active item's look is the design's pine gradient, the same in every practice.
const ITEM_ACTIVE =
  'text-white bg-[linear-gradient(90deg,rgba(28,78,63,.92),rgba(46,122,99,.55))] shadow-[inset_0_0_0_1px_rgba(74,151,129,.30),0_8px_24px_rgba(20,58,47,.50)] [&_svg]:stroke-[var(--desk-pine-400)]';

function Item({ item, active, rail, Link, onNavigate }: { item: SidebarItem; active: boolean; rail: boolean; Link: LinkLike; onNavigate?: () => void }) {
  const state = active ? ITEM_ACTIVE : ITEM_IDLE;
  if (rail) {
    return (
      <div className="group relative">
        <Link
          href={item.href}
          aria-label={item.label}
          aria-current={active ? 'page' : undefined}
          onClick={onNavigate}
          className={`${ITEM_BASE} ${state} justify-center w-[44px] mx-auto focus-visible:outline-2 focus-visible:outline-[var(--desk-pine-400)]`}
        >
          <span className="flex [&_svg]:h-[18px] [&_svg]:w-[18px]">{item.icon}</span>
        </Link>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 whitespace-nowrap rounded-[8px] bg-[var(--desk-sidebar-hover)] px-2.5 py-1 text-[12px] font-semibold text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
        >
          {item.label}
        </span>
      </div>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={`${ITEM_BASE} ${state} px-3 gap-2.5`}
    >
      {active ? <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[20px] bg-[var(--desk-pine-400)] rounded-r-[3px]" /> : null}
      <span className="flex flex-none [&_svg]:h-[18px] [&_svg]:w-[18px]">{item.icon}</span>
      <span className="truncate">{item.label}</span>
      {item.badge ? <span className="ml-auto">{item.badge}</span> : null}
    </Link>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d={collapsed ? 'M15 4v16M10 10l-2 2 2 2' : 'M9 4v16M15 10l2 2-2 2'} />
    </svg>
  );
}

/**
 * The workspace navigation, in three modes:
 *   full    — 248px, labels and group headings (desktop).
 *   rail    — 76px, icons with tooltips; every item shown (tablet, or collapsed desktop).
 *   overlay — the full sidebar over the page, as a modal (tablet expand, phone "More").
 * It renders what it is given; which items a person sees is the app's decision.
 */
export function Sidebar({
  sections,
  activeKey,
  mode,
  brand,
  account,
  LinkComponent = PlainLink,
  openSections = {},
  onSectionToggle,
  onToggleCollapse,
  onClose,
  onNavigate,
}: SidebarProps) {
  const rail = mode === 'rail';
  const overlay = mode === 'overlay';
  const panelRef = useRef<HTMLElement>(null);
  useFocusTrap(panelRef, overlay);

  useEffect(() => {
    if (!overlay || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [overlay, onClose]);

  const isOpen = (s: SidebarSection) => !s.collapsible || rail || (openSections[s.key] ?? true);

  const nav = (
    <nav aria-label="Main" className={`no-scrollbar flex-1 min-h-0 overflow-y-auto space-y-1 ${rail ? 'flex flex-col items-center' : ''}`}>
      {sections.map((section, sIndex) => (
        <div key={section.key} className={rail ? 'w-full space-y-1' : 'space-y-1'}>
          {rail && sIndex > 0 ? <div role="separator" className="h-px w-8 mx-auto my-2 bg-white/10" /> : null}
          {!rail && section.label ? (
            section.collapsible ? (
              <button
                type="button"
                aria-expanded={isOpen(section)}
                onClick={() => onSectionToggle?.(section.key, !isOpen(section))}
                className="w-full flex items-center gap-2 text-[9px] font-black tracking-[0.2em] uppercase text-[var(--desk-text-muted)] hover:text-[var(--desk-text-subtle)] px-3 pb-2 pt-5 transition-colors cursor-pointer"
              >
                {section.icon}
                {section.label}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={`ml-auto transition-transform ${isOpen(section) ? 'rotate-180' : ''}`}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            ) : (
              <div className="text-[9px] font-black tracking-[0.2em] uppercase text-[var(--desk-text-muted)] px-3 pb-2 pt-5">{section.label}</div>
            )
          ) : null}
          {isOpen(section) ? (
            <div className={!rail && section.collapsible ? '-mx-1.5 px-1.5 py-1.5 rounded-[14px] bg-white/[0.045] space-y-1' : 'space-y-1'}>
              {section.groups.map((group, gIndex) => (
                <div key={group.key} className="space-y-1">
                  {rail && gIndex > 0 ? <div role="separator" className="h-px w-6 mx-auto my-1.5 bg-white/10" /> : null}
                  {!rail && group.label ? (
                    <div className={`text-[9px] font-black tracking-[0.2em] uppercase text-[var(--desk-text-muted)] px-3 pb-1 ${gIndex === 0 ? 'pt-1.5' : 'pt-3'}`}>{group.label}</div>
                  ) : null}
                  {group.items.map((item) => (
                    <Item key={item.key} item={item} rail={rail} active={item.key === activeKey} Link={LinkComponent} onNavigate={onNavigate} />
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
      {onToggleCollapse && !overlay ? (
        <button
          type="button"
          aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
          title={rail ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCollapse}
          className={`mt-2 flex items-center h-[36px] gap-2.5 rounded-[12px] cursor-pointer text-[var(--desk-text-subtle)] hover:bg-[var(--desk-sidebar-hover)] text-[12.5px] font-semibold ${rail ? 'justify-center w-[44px] mx-auto' : 'w-full px-3'}`}
        >
          <CollapseIcon collapsed={rail} />
          {rail ? null : 'Collapse'}
        </button>
      ) : null}
    </nav>
  );

  const panel = (
    <aside
      ref={panelRef}
      role={overlay ? 'dialog' : undefined}
      aria-modal={overlay ? true : undefined}
      aria-label={overlay ? 'Menu' : 'Sidebar'}
      className={`${rail ? 'w-[76px] px-2.5' : 'w-[248px] px-3.5'} py-5 h-screen flex flex-col gap-6 bg-[var(--desk-sidebar)] text-white select-none border-r border-slate-800/50 ${
        overlay ? 'fixed inset-y-0 left-0 z-50 shadow-2xl' : 'sticky top-0 shrink-0'
      }`}
    >
      <div className={`px-2 py-1 flex items-center ${rail ? 'justify-center' : 'justify-between'}`}>
        {brand(mode)}
        {overlay && onClose ? (
          <button type="button" aria-label="Close menu" onClick={onClose} className="p-1 text-[var(--desk-text-subtle)] hover:text-white cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>
      {nav}
      {account ? <div className={`pt-3.5 border-t border-white/[0.07] ${rail ? 'flex justify-center' : 'px-2'}`}>{account(mode)}</div> : null}
    </aside>
  );

  if (!overlay) return panel;
  return (
    <>
      <div data-testid="sidebar-backdrop" onClick={onClose} className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm" />
      {panel}
    </>
  );
}
