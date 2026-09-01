import * as React from 'react';

export interface BarDatum {
  label: string;
  value: number;
  /** Fill with --brand-primary rather than --brand-bar. Defaults to the last datum. */
  current?: boolean;
}

/**
 * The revenue bar row. Current month fills with the tenant primary; prior
 * months use --brand-bar. Heights transition 300ms ease-out.
 * Charts are CSS divs here — in production use the codebase's chart library
 * and match this treatment.
 *
 * @startingPoint section="Data" subtitle="12-month revenue bars" viewport="700x200"
 */
export interface BarChartProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style'> {
  data: BarDatum[];
  /** Max bar height. 96 dashboard, 220 analytics. */
  height?: number;
  gap?: number;
  /** Render the value above each bar (analytics variant). */
  showValues?: boolean;
  formatValue?: (v: number) => React.ReactNode;
  style?: React.CSSProperties;
}
export declare function BarChart(props: BarChartProps): JSX.Element;
