import * as React from 'react';

/**
 * The 9px / 900 / 0.22em uppercase label above nearly every card and
 * section. The system's most distinctive type signature — use it
 * consistently rather than inventing section headings.
 *
 * @startingPoint section="Core" subtitle="9px/900/0.22em section label" viewport="700x140"
 */
export interface EyebrowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style'> {
  /** 'subtle' (default) | 'muted' | 'tenant' | 'invert' (on dark/tenant fills). */
  tone?: 'subtle' | 'muted' | 'tenant' | 'invert';
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export declare function Eyebrow(props: EyebrowProps): JSX.Element;
