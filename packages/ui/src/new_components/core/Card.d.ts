import * as React from 'react';

/**
 * The workspace surface: white, 24px radius, hairline #E2E8F0 border,
 * shadow-sm. `hoverable` adds the standard lift.
 *
 * @startingPoint section="Core" subtitle="Standard, raised, hoverable, dark" viewport="700x260"
 */
export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style'> {
  /** 'none' | 'sm' | 'md' | 'lg' or any CSS padding string/number. Default 'lg'. */
  padding?: 'none' | 'sm' | 'md' | 'lg' | string | number;
  /** Default 24 (--desk-radius-card). 22 for booking panels, 20 for KPI tiles. */
  radius?: number;
  /** translateY(-1px) + shadow-hover on hover. Use on clickable rows and cards. */
  hoverable?: boolean;
  /** shadow-lg instead of shadow-sm. */
  raised?: boolean;
  /** Slate #0F172A hero variant — dark revenue cards. */
  dark?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export declare function Card(props: CardProps): JSX.Element;
