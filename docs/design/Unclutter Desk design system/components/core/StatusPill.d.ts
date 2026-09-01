import * as React from 'react';

export type StatusKind = 'active' | 'pending' | 'inactive' | 'danger' | 'info';

/**
 * Status pill with leading dot — Confirmed, Awaiting intake, Paused,
 * Cancelled, Rescheduled.
 *
 * @startingPoint section="Core" subtitle="Five statuses with leading dot" viewport="700x150"
 */
export interface StatusPillProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'style'> {
  status?: StatusKind;
  /** Show the leading dot. Default true. */
  dot?: boolean;
  /** Default 26. Analytics delta pills are 22. */
  height?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/** Token map for the five statuses — { fg, dot, bg, bd }. */
export declare const STATUS: Record<StatusKind, { fg: string; dot: string; bg: string; bd: string }>;

export declare function StatusPill(props: StatusPillProps): JSX.Element;
