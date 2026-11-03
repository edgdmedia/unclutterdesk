import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { HeaderSlotContext } from './headerSlot';
import { useViewport } from './useViewport';
import { Sidebar, type SidebarMode, type SidebarProps } from '../navigation/Sidebar';
import { BottomNav, type BottomNavProps } from '../navigation/BottomNav';

export interface AppShellProps {
  sidebar?: Omit<SidebarProps, 'mode' | 'onToggleCollapse' | 'onClose' | 'onNavigate'>;
  /** The desktop preference; tablets always get the rail. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  bottomNav?: Omit<BottomNavProps, 'onMore'>;
  banner?: ReactNode;
  /**
   * Frame-wide header items (the notification bell). Shown at the right of
   * the page's PageHeader; a slim right-aligned bar only on pages without one.
   */
  header?: ReactNode;
  children: ReactNode;
}

/**
 * The workspace frame. It decides the sidebar's mode from the screen:
 * phone, a drawer from "More"; tablet, the rail, expanding over the page;
 * desktop, full or rail by the user's choice. The content column fills the
 * rest and can never be forced wider than the screen.
 */
export function AppShell({ sidebar, collapsed = false, onCollapsedChange, bottomNav, banner, header, children }: AppShellProps) {
  const viewport = useViewport();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const [claims, setClaims] = useState(0);
  const claim = useCallback(() => {
    setClaims((n) => n + 1);
    return () => setClaims((n) => n - 1);
  }, []);
  const slot = useMemo(() => (header ? { items: header, claim } : null), [header, claim]);

  const openOverlay = () => {
    opener.current = document.activeElement as HTMLElement | null;
    setOverlayOpen(true);
  };
  const closeOverlay = () => {
    setOverlayOpen(false);
    opener.current?.focus?.();
  };

  // A tablet turned to landscape, or a window widened, must not keep an
  // overlay open on top of the desktop sidebar.
  useEffect(() => {
    if (viewport === 'desktop') setOverlayOpen(false);
  }, [viewport]);

  // A guided tour walks the page itself, so the drawer must step aside for it.
  useEffect(() => {
    const close = () => setOverlayOpen(false);
    window.addEventListener('unclutter:tour-start', close);
    return () => window.removeEventListener('unclutter:tour-start', close);
  }, []);

  const inlineMode: SidebarMode | null = !sidebar || viewport === 'phone' ? null : viewport === 'desktop' && !collapsed ? 'full' : 'rail';
  const onToggleCollapse =
    viewport === 'desktop' ? (onCollapsedChange ? () => onCollapsedChange(!collapsed) : undefined) : openOverlay;
  const showBottom = Boolean(bottomNav) && viewport === 'phone';

  return (
    <div className="flex min-h-screen bg-[var(--desk-surface)]">
      {inlineMode && sidebar ? <Sidebar {...sidebar} mode={inlineMode} onToggleCollapse={onToggleCollapse} /> : null}
      {overlayOpen && sidebar ? <Sidebar {...sidebar} mode="overlay" onClose={closeOverlay} onNavigate={closeOverlay} /> : null}
      <div data-testid="app-content" className={`flex-1 min-w-0 flex flex-col ${showBottom ? 'pb-[84px]' : ''}`.trim()}>
        {header && claims === 0 ? (
          <div data-testid="app-header" className="flex items-center justify-end gap-2 px-4 py-2 md:px-6 shrink-0">
            {header}
          </div>
        ) : null}
        {banner}
        <HeaderSlotContext.Provider value={slot}>{children}</HeaderSlotContext.Provider>
      </div>
      {showBottom && bottomNav ? (
        <div className="fixed bottom-0 inset-x-0 z-40">
          <BottomNav {...bottomNav} onMore={sidebar ? openOverlay : undefined} />
        </div>
      ) : null}
    </div>
  );
}
