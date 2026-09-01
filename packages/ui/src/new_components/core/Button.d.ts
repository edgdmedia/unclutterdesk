import * as React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link' | 'danger' | 'tenantSoft';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'cta';

/**
 * The Desk button.
 *
 * `primary` and `tenantSoft` read the white-label tenant slots, so an
 * arbitrary tenant hue works with no second stored token — hover is
 * `filter: brightness(1.08)` on the element itself.
 *
 * @startingPoint section="Core" subtitle="Primary, secondary, ghost, link, danger" viewport="700x220"
 */
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  /** Visual role. Default 'primary'. */
  variant?: ButtonVariant;
  /** 32 / 40 / 44 / 48 / 52px. Default 'md'. 'cta' is the booking portal CTA. */
  size?: ButtonSize;
  fullWidth?: boolean;
  disabled?: boolean;
  /** Leading icon node — 14-15px inline Lucide glyph. */
  icon?: React.ReactNode;
  /** Trailing icon node — e.g. the right arrow on Confirm & Book. */
  iconAfter?: React.ReactNode;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export declare function Button(props: ButtonProps): JSX.Element;
