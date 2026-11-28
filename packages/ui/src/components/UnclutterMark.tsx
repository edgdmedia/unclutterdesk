// @ts-nocheck
import React from 'react';
import icon from '../brand/therapysts/logos/therapysts-app-icon.svg?url';

interface UnclutterMarkProps {
  size?: number;
  className?: string;
  /** Kept for existing callers; the Therapysts icon has no badge. */
  showBadge?: boolean;
}

/** The product mark: the Therapysts app icon (a tile, so it reads on any backdrop). */
export function UnclutterMark({ size = 32, className = '' }: UnclutterMarkProps) {
  return <img src={icon} width={size} height={size} alt="" aria-hidden="true" className={className} />;
}
