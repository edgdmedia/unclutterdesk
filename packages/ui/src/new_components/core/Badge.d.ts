import * as React from 'react';

export type BadgeTone =
  | 'neutral' | 'pine' | 'mint' | 'tenant' | 'tenantSolid' | 'secondary' | 'dark';

/**
 * Uppercase pill: WHITE-LABEL, SELECTED, MOST BOOKED, CLINICAL PSYCHOLOGY,
 * and the DESK badge in the sidebar lockup ('mint').
 *
 * Never use a gold-family fill here — gold is reserved for one rare
 * decorative accent and is not available to badges.
 *
 * @startingPoint section="Core" subtitle="Uppercase pill, 7 tones" viewport="700x150"
 */
export interface BadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'style'> {
  tone?: BadgeTone;
  /** Default 22. The sidebar DESK badge is 18. */
  height?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export declare function Badge(props: BadgeProps): JSX.Element;
