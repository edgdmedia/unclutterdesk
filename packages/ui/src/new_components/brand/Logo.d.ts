import * as React from 'react';

/**
 * The Unclutter Desk mark and lockup.
 *
 * The "unclutter" wordmark is deliberately shared with the wider Unclutter
 * family; the DESK badge is what makes it this product. The badge is mint
 * (--desk-pine-200 on --desk-pine-900) — never gold.
 *
 * @startingPoint section="Brand" subtitle="Mark, lockup, powered-by line" viewport="700x180"
 */
export interface LogoProps extends Omit<React.HTMLAttributes<HTMLElement>, 'style'> {
  /** 'lockup' mark + wordmark + DESK badge · 'mark' tile only · 'poweredBy' public footer line. */
  variant?: 'lockup' | 'mark' | 'poweredBy';
  /** Mark edge length. 30 sidebar, 16 powered-by footer. */
  size?: number;
  /** Relative path from the consuming page to the design system root, e.g. '../../'. */
  assetBase?: string;
  /** Wordmark color: true → #F8FAFC for the slate sidebar, false → pine-800. */
  onDark?: boolean;
  style?: React.CSSProperties;
}
export declare function Logo(props: LogoProps): JSX.Element;
