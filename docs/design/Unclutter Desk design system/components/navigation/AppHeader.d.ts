import * as React from 'react';

/**
 * 80px white app header: eyebrow + screen title left, action cluster right
 * at margin-left:auto with 10px gaps.
 *
 * @startingPoint section="Navigation" subtitle="80px header with action cluster" viewport="700x140"
 */
export interface AppHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, 'style'> {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Right-hand action cluster. */
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function AppHeader(props: AppHeaderProps): JSX.Element;
