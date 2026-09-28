import type { ReactNode } from 'react';

/** A small figure with its label underneath, as in the Overview revenue card. */
export function MetricTile({ value, label, className = '' }: { value: ReactNode; label: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 p-2.5 md:p-[12px_14px] rounded-[16px] bg-[var(--desk-surface)] border border-[var(--desk-border)] ${className}`.trim()}>
      <span className="block truncate text-[20px] md:text-[22px] font-extrabold tracking-[-0.03em] text-[var(--desk-text)] leading-none mb-1">
        {value}
      </span>
      <span className="block truncate text-[11px] font-medium text-[var(--desk-text-muted)]">{label}</span>
    </div>
  );
}
