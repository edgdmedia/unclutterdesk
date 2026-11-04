// @ts-nocheck
import React from 'react';

export type StatusType = 'Confirmed' | 'Active' | 'Pending Intake' | 'Awaiting intake' | 'Inactive' | 'Paused' | 'Danger';

export type StatusTone = 'ok' | 'info' | 'warn' | 'danger' | 'muted';

export interface StatusBadgeProps {
  status: StatusType | string;
  /** The colour to use. Without it, the colour is guessed from the words (older callers). */
  tone?: StatusTone;
  className?: string;
}

const TONES: Record<StatusTone, string> = {
  ok: 'bg-[var(--desk-active-bg)] text-[var(--desk-active)] border-[var(--desk-active-border)]',
  info: 'bg-[var(--desk-info-bg)] text-[var(--desk-info)] border-[var(--desk-info-border)]',
  warn: 'bg-[var(--desk-pending-bg)] text-[var(--desk-pending)] border-[var(--desk-pending-border)]',
  danger: 'bg-[var(--desk-danger-bg)] text-[var(--desk-danger)] border-[var(--desk-danger-border)]',
  muted: 'bg-[var(--desk-surface-muted)] text-[var(--desk-text-muted)] border-[var(--desk-border)]',
};

export function StatusBadge({ status, tone, className = '' }: StatusBadgeProps) {
  const normalized = status.toLowerCase();

  let styles = 'bg-[var(--desk-surface-muted)] text-[var(--desk-text-muted)] border-[var(--desk-border)]';
  if (tone) {
    styles = TONES[tone];
  } else if (normalized.includes('confirmed') || normalized.includes('active')) {
    styles = 'bg-[var(--desk-active-bg)] text-[var(--desk-active)] border-[var(--desk-active-border)]';
  } else if (normalized.includes('pending') || normalized.includes('intake')) {
    styles = 'bg-[var(--desk-pending-bg)] text-[var(--desk-pending)] border-[var(--desk-pending-border)]';
  } else if (normalized.includes('danger') || normalized.includes('cancelled')) {
    styles = 'bg-[var(--desk-danger-bg)] text-[var(--desk-danger)] border-[var(--desk-danger-border)]';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${styles} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span>{status}</span>
    </span>
  );
}
