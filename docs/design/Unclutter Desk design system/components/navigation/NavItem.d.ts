import * as React from 'react';

/**
 * Sidebar navigation item. Active is the pine gradient with a 3px edge
 * marker and pine icon stroke — this is where the retired gold accent lived.
 * Only one item is ever active. Hover changes background and text only:
 * no transform, no scale.
 *
 * @startingPoint section="Navigation" subtitle="Rest, hover, active, with counters" viewport="700x260"
 */
export interface NavItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  label: React.ReactNode;
  /** 18px stroke-2 Lucide glyph. */
  icon?: React.ReactNode;
  active?: boolean;
  /** Counter at margin-left:auto. Cap display at '99+'. */
  count?: React.ReactNode;
  /** 'neutral' informational totals · 'pine' time-sensitive · 'danger' needs action. */
  countTone?: 'neutral' | 'pine' | 'danger';
  style?: React.CSSProperties;
}
export declare function NavItem(props: NavItemProps): JSX.Element;
