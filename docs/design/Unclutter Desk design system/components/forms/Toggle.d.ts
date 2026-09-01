import * as React from 'react';

/**
 * The practice-status switch. Track is success green when on,
 * --desk-border-strong when off; knob translates 200ms ease-out.
 *
 * @startingPoint section="Forms" subtitle="Practice status switch, on and off" viewport="700x140"
 */
export interface ToggleProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'style'> {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  /** Default 60 (height derives at 34/60). Mobile is 58. */
  width?: number;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export declare function Toggle(props: ToggleProps): JSX.Element;
