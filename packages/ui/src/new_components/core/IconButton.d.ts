import * as React from 'react';

export type IconButtonVariant = 'outline' | 'plain' | 'muted' | 'tenant';

/**
 * Square icon-only control: copy buttons, calendar prev/next, row overflow
 * menus, the header notification bell.
 *
 * @startingPoint section="Core" subtitle="Square icon control, 32-44px" viewport="700x150"
 */
export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  /** Edge length in px. Default 40. */
  size?: number;
  variant?: IconButtonVariant;
  /** Override the radius. Defaults to 14px at >=40px, 10px below. */
  radius?: number;
  /** Red notification dot at top-right, ringed in white. */
  dot?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export declare function IconButton(props: IconButtonProps): JSX.Element;
