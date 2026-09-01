import * as React from 'react';

/**
 * Single-select on a muted track: Week/Day/Month, Online/In-person,
 * 30 days/90 days/12 months.
 *
 * @startingPoint section="Forms" subtitle="Muted track, white selected segment" viewport="700x150"
 */
export interface SegmentedControlProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'style'> {
  options: string[];
  /** Defaults to the first option. */
  value?: string;
  onChange?: (value: string) => void;
  /** Default 40. The booking form's format control is 46. */
  height?: number;
  style?: React.CSSProperties;
}
export declare function SegmentedControl(props: SegmentedControlProps): JSX.Element;
