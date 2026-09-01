// @ts-nocheck
import React from 'react';

export type StatusType = 'Confirmed' | 'Active' | 'Pending Intake' | 'Awaiting intake' | 'Inactive' | 'Paused' | 'Danger';

export interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const normalized = status.toLowerCase();

  let styles = 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]';
  if (normalized.includes('confirmed') || normalized.includes('active')) {
    styles = 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]';
  } else if (normalized.includes('pending') || normalized.includes('intake')) {
    styles = 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]';
  } else if (normalized.includes('danger') || normalized.includes('cancelled')) {
    styles = 'bg-[#FFF1F2] text-[#E11D48] border-[#FECDD3]';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${styles} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span>{status}</span>
    </span>
  );
}
