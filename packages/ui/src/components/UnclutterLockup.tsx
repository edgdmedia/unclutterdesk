// @ts-nocheck
import React from 'react';
import { UnclutterMark } from './UnclutterMark';
import lockup from '../brand/therapysts/logos/therapysts-lockup.min.svg?url';
import lockupOnDark from '../brand/therapysts/logos/therapysts-lockup-on-dark.min.svg?url';

interface UnclutterLockupProps {
  markSize?: number;
  variant?: 'light' | 'dark'; // 'light' for light backdrop, 'dark' for dark navy/slate backdrop
  showText?: boolean;
  className?: string;
}

/** The Therapysts lockup (mark and wordmark), or the mark alone without text. */
export function UnclutterLockup({ markSize = 34, variant = 'light', showText = true, className = '' }: UnclutterLockupProps) {
  if (!showText) return <UnclutterMark size={markSize} className={`shrink-0 ${className}`} />;
  return (
    <img
      src={variant === 'dark' ? lockupOnDark : lockup}
      alt="Therapysts"
      height={markSize}
      style={{ height: markSize, width: 'auto' }}
      className={`inline-block ${className}`}
    />
  );
}
