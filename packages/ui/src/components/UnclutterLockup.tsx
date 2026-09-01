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
 * Official Unclutter Desk Full Lockup Component
 * Renders the official geometric crystal mark + bold unclutter typography + gold OS pill badge.
 */
export function UnclutterLockup({
  markSize = 34,
  variant = 'light',
  showText = true,
  className = '',
}: UnclutterLockupProps) {
  const isDark = variant === 'dark';
  const textColor = isDark ? 'text-white' : 'text-[#0F3A53]';
  const osPillCls = isDark
    ? 'bg-[#E3B341] text-[#0F172A]'
    : 'border border-[#E3B341] text-[#0F3A53] bg-transparent';

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <UnclutterMark size={markSize} className="shrink-0" />
      {showText && (
        <div className="flex items-center gap-2">
          <span className={`font-bold tracking-[-0.03em] text-[20px] ${textColor}`}>
            unclutter
          </span>
          <span
            className={`h-[22px] px-2.5 rounded-full text-[11px] font-extrabold tracking-[0.06em] inline-flex items-center justify-center ${osPillCls}`}
          >
            OS
          </span>
        </div>
      )}
    </div>
  );
}
