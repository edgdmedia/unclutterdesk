// @ts-nocheck
import React from 'react';
import { UnclutterMark } from './UnclutterMark';

interface UnclutterLockupProps {
  markSize?: number;
  variant?: 'light' | 'dark'; // 'light' for light backdrop, 'dark' for dark navy/slate backdrop
  showText?: boolean;
  className?: string;
}

/**
 * The Unclutter Desk lockup, matching assets/unclutterdesk-lockup.svg:
 * the mark, the "unclutter" wordmark, and the DESK badge.
 */
export function UnclutterLockup({
  markSize = 34,
  variant = 'light',
  showText = true,
  className = '',
}: UnclutterLockupProps) {
  const isDark = variant === 'dark';
  // Inline rather than utility classes: this component is rendered by apps
  // whose Tailwind builds differ, and the badge colours must not depend on
  // each one generating the same arbitrary values.
  const textColor = isDark ? '#FFFFFF' : '#143A2F';
  const badgeStyle = isDark
    ? { backgroundColor: '#B6D8CC', color: '#0E2A22' }
    : { border: '1.5px solid #24614F', color: '#143A2F', backgroundColor: 'transparent' };

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <UnclutterMark size={markSize} showBadge={!showText} className="shrink-0" />
      {showText && (
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-[-0.03em] text-[20px]" style={{ color: textColor }}>
            unclutter
          </span>
          <span
            className="h-[22px] px-2.5 rounded-full text-[10.5px] font-extrabold tracking-[0.08em] inline-flex items-center justify-center"
            style={badgeStyle}
          >
            DESK
          </span>
        </div>
      )}
    </div>
  );
}
