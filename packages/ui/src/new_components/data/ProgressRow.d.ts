import * as React from 'react';

/**
 * Session-mix / referral-source row: name, count, right-aligned percentage,
 * and a 10px track with a filled bar.
 *
 * @startingPoint section="Data" subtitle="Labelled percentage bar" viewport="700x180"
 */
export interface ProgressRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style'> {
  label: React.ReactNode;
  /** Secondary count, e.g. '412 sessions'. */
  meta?: React.ReactNode;
  percent?: number;
  /** 'tenant' Individual · 'secondary' Couples · 'muted' everything else. */
  tone?: 'tenant' | 'secondary' | 'muted';
  /** Set false for the referral-source list, which has no track. */
  track?: boolean;
  style?: React.CSSProperties;
}
export declare function ProgressRow(props: ProgressRowProps): JSX.Element;
