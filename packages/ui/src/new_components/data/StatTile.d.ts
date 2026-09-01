import * as React from 'react';

/**
 * KPI tile: eyebrow over a tabular value, with an optional delta pill.
 * `compact` is the small in-card variant used inside the Revenue Summary.
 *
 * @startingPoint section="Data" subtitle="KPI tile with delta, compact variant" viewport="700x160"
 */
export interface StatTileProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style'> {
  label: React.ReactNode;
  value: React.ReactNode;
  /** e.g. '+18.2%' / '−2.3 pts'. */
  delta?: React.ReactNode;
  deltaTone?: 'active' | 'pending';
  /** 96px min-width, 16px radius, label below the value — the in-card variant. */
  compact?: boolean;
  style?: React.CSSProperties;
}
export declare function StatTile(props: StatTileProps): JSX.Element;
