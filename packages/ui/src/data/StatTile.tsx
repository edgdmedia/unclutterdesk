import type { ReactNode } from 'react';
import { Eyebrow } from '../components/Eyebrow';

const BOX = {
  card: 'p-[16px_18px] rounded-[20px] bg-[var(--desk-card)] border border-[var(--desk-border)] shadow-[var(--desk-shadow-sm)]',
  inset: 'p-3.5 rounded-[16px] bg-[var(--desk-surface)] border border-[var(--desk-border)]',
} as const;

const VALUE_SIZE = {
  sm: 'text-[18px]',
  md: 'text-[22px]',
  lg: 'text-[26px] tracking-[-0.035em]',
} as const;

const DELTA = {
  up: 'bg-[var(--desk-active-bg)] border-[var(--desk-active-border)] text-[var(--desk-active)]',
  down: 'bg-[var(--desk-danger-bg)] border-[var(--desk-danger-border)] text-[var(--desk-danger)]',
  neutral: 'bg-[var(--desk-inactive-bg)] border-[var(--desk-inactive-border)] text-[var(--desk-inactive)]',
} as const;

export interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  deltaTone?: keyof typeof DELTA;
  variant?: keyof typeof BOX;
  size?: keyof typeof VALUE_SIZE;
  /** A colour only known at runtime, such as the practice's brand colour. */
  valueColor?: string;
  className?: string;
  children?: ReactNode;
}

/** A labelled figure. Truncates rather than widening its column. */
export function StatTile({
  label,
  value,
  delta,
  deltaTone = 'up',
  variant = 'card',
  size = 'md',
  valueColor,
  className = '',
  children,
}: StatTileProps) {
  const title = typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
  return (
    <div className={`min-w-0 ${BOX[variant]} ${className}`.trim()}>
      <Eyebrow className="mb-1 block truncate">{label}</Eyebrow>
      <div className="flex items-baseline justify-between gap-2 min-w-0">
        <span
          title={title}
          style={valueColor ? { color: valueColor } : undefined}
          className={`min-w-0 truncate font-extrabold leading-tight text-[var(--desk-text)] ${VALUE_SIZE[size]}`}
        >
          {value}
        </span>
        {delta ? (
          <span className={`shrink-0 h-[22px] px-2 rounded-full border text-[11.5px] font-bold inline-flex items-center gap-0.5 ${DELTA[deltaTone]}`}>
            {delta}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
