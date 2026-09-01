import * as React from 'react';
import { NavItemProps } from './NavItem';

export interface SidebarItem {
  key?: string;
  label: string;
  icon?: React.ReactNode;
  count?: React.ReactNode;
  countTone?: NavItemProps['countTone'];
}

/**
 * The workspace shell sidebar: lockup, five nav items, pinned user footer.
 * 248px expanded, 76px collapsed (icon-only, mark instead of lockup, avatar
 * without name). Slate in EVERY tenancy — tenant color enters only through
 * the active item's gradient, never the background.
 *
 * @startingPoint section="Navigation" subtitle="Expanded 248px and collapsed 76px" viewport="360x560"
 */
export interface SidebarProps extends Omit<React.HTMLAttributes<HTMLElement>, 'style'> {
  items: SidebarItem[];
  /** Key of the active item. */
  active?: string;
  onSelect?: (key: string) => void;
  user?: { initials: string; name: string; role: string };
  /** Relative path from the consuming page to the design system root, e.g. '../../'. Forwarded to Logo. */
  assetBase?: string;
  /** Renders the 76px icon-only rail. */
  collapsed?: boolean;
  /** Supplying this renders the collapse/expand toggle row above the user footer. */
  onToggleCollapse?: () => void;
  style?: React.CSSProperties;
}
export declare function Sidebar(props: SidebarProps): JSX.Element;
