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
 * The 248px workspace shell sidebar: lockup, five nav items, pinned user
 * footer. Slate in EVERY tenancy — tenant color enters only through the
 * active item's gradient, never the background.
 *
 * @startingPoint section="Navigation" subtitle="248px slate workspace sidebar" viewport="320x560"
 */
export interface SidebarProps extends Omit<React.HTMLAttributes<HTMLElement>, 'style'> {
  items: SidebarItem[];
  /** Key of the active item. */
  active?: string;
  onSelect?: (key: string) => void;
  user?: { initials: string; name: string; role: string };
  /** Relative path from the consuming page to the design system root, e.g. '../../'. Forwarded to Logo. */
  assetBase?: string;
  style?: React.CSSProperties;
}
export declare function Sidebar(props: SidebarProps): JSX.Element;
