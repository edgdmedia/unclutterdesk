import * as React from 'react';

/**
 * Multi-line field. Non-resizable by design, 1.6 line-height.
 * Used once: "Share concerns (optional)" on the booking intake form.
 *
 * @startingPoint section="Forms" subtitle="Non-resizable multi-line field" viewport="700x200"
 */
export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'style'> {
  label?: React.ReactNode;
  optionalLabel?: string;
  /** Default 3. */
  rows?: number;
  style?: React.CSSProperties;
  wrapperStyle?: React.CSSProperties;
}
export declare function Textarea(props: TextareaProps): JSX.Element;
