import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  children: ReactNode;
}

/**
 * The workspace frame. It decides the sidebar's mode from the screen:
 * phone, a drawer from "More"; tablet, the rail, expanding over the page;
 * desktop, full or rail by the user's choice. The content column fills the
 * rest and can never be forced wider than the screen.
 */
export function AppShell({ sidebar, collapsed = false, onCollapsedChange, bottomNav, banner, children }: AppShellProps) {
  const viewport = useViewport();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

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

  const inlineMode: SidebarMode | null = !sidebar || viewport === 'phone' ? null : viewport === 'desktop' && !collapsed ? 'full' : 'rail';
  const onToggleCollapse =
    viewport === 'desktop' ? (onCollapsedChange ? () => onCollapsedChange(!collapsed) : undefined) : openOverlay;
  const showBottom = Boolean(bottomNav) && viewport === 'phone';

  return (
    <div className="flex min-h-screen bg-[var(--desk-surface)]">
      {inlineMode && sidebar ? <Sidebar {...sidebar} mode={inlineMode} onToggleCollapse={onToggleCollapse} /> : null}
      {overlayOpen && sidebar ? <Sidebar {...sidebar} mode="overlay" onClose={closeOverlay} onNavigate={closeOverlay} /> : null}
      <div data-testid="app-content" className={`flex-1 min-w-0 flex flex-col ${showBottom ? 'pb-[84px]' : ''}`.trim()}>
        {banner}
        {children}
      </div>
      {showBottom && bottomNav ? (
        <div className="fixed bottom-0 inset-x-0 z-40">
          <BottomNav {...bottomNav} onMore={sidebar ? openOverlay : undefined} />
        </div>
      ) : null}
    </div>
  );
}
