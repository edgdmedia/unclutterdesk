import * as React from 'react';

/**
 * Desk text field. 46px in the booking portal, 44px in the workspace header.
 * Focus switches background #F8FAFC → #FFFFFF, border → #94A3B8, plus the
 * tenant focus ring.
 *
 * @startingPoint section="Forms" subtitle="Labelled field, icon and trailing slots" viewport="700x200"
 */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'style'> {
  label?: React.ReactNode;
  /** Rendered 500-weight subtle after the label, e.g. "(optional)". */
  optionalLabel?: string;
  /** Default 46. Workspace header fields are 44. */
  height?: number;
  /** Leading glyph — 15px Lucide. */
  icon?: React.ReactNode;
  /** Node pinned right inside the field, e.g. a 32px copy IconButton. */
  trailing?: React.ReactNode;
  readOnly?: boolean;
  /** #F1F5F9 fill — read-only / search variants. */
  muted?: boolean;
  /** JetBrains Mono at 12.5px — hex codes, CNAME hosts, booking refs. */
  mono?: boolean;
  style?: React.CSSProperties;
  wrapperStyle?: React.CSSProperties;
}
export declare function Input(props: InputProps): JSX.Element;
