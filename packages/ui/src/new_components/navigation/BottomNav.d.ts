import * as React from 'react';

export interface BottomNavItem { key?: string; label: string; icon?: React.ReactNode }

/**
 * The mobile app's frosted bottom navigation — 92px, radius 24px 24px 0 0.
 * Active tab is a solid slate pill with white icon AND label; never an
 * icon-only treatment.
 *
 * @startingPoint section="Navigation" subtitle="Frosted 4-tab mobile nav" viewport="390x120"
 */
export interface BottomNavProps extends Omit<React.HTMLAttributes<HTMLElement>, 'style'> {
  items: BottomNavItem[];
  active?: string;
  onSelect?: (key: string) => void;
  style?: React.CSSProperties;
}
export declare function BottomNav(props: BottomNavProps): JSX.Element;
