import * as React from 'react';

export type AvatarTone = 'tenant' | 'secondary' | 'pine' | 'slate' | 'muted';

/**
 * Initials in a rounded square. There is no photography anywhere in Desk;
 * production should render an uploaded photo when present and fall back to
 * these initials.
 *
 * @startingPoint section="Core" subtitle="Initials chip, 32-76px, 5 tones" viewport="700x170"
 */
export interface AvatarChipProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style'> {
  /** Two letters, e.g. 'JS', 'AO', 'TB'. */
  initials?: string;
  /** Edge length. 32 sidebar footer, 38 rows, 46 receipt, 76 profile. */
  size?: number;
  /** Care-type coding: 'tenant' Individual, 'secondary' Couples. */
  tone?: AvatarTone;
  radius?: number;
  /** Green presence dot, bottom-right, 3px white ring. */
  online?: boolean;
  /** 3px --brand-ring halo. Used on the 76px profile avatar. */
  ring?: boolean;
  style?: React.CSSProperties;
}

export declare function AvatarChip(props: AvatarChipProps): JSX.Element;
