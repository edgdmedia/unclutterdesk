import React from 'react';

/**
 * Status pill with leading dot. Success and pending were retuned when the
 * palette moved to pine: emerald sat too close to the new primary, and amber
 * was gold-family. Inactive, danger and info are unchanged.
 */
export const STATUS = {
  active:   { fg: 'var(--desk-active)',   dot: 'var(--desk-active-dot)',   bg: 'var(--desk-active-bg)',   bd: 'var(--desk-active-border)' },
  pending:  { fg: 'var(--desk-pending)',  dot: 'var(--desk-pending-dot)',  bg: 'var(--desk-pending-bg)',  bd: 'var(--desk-pending-border)' },
  inactive: { fg: 'var(--desk-inactive)', dot: 'var(--desk-inactive)',     bg: 'var(--desk-inactive-bg)', bd: 'var(--desk-inactive-border)' },
  danger:   { fg: 'var(--desk-danger)',   dot: 'var(--desk-danger)',       bg: 'var(--desk-danger-bg)',   bd: 'var(--desk-danger-border)' },
  info:     { fg: 'var(--desk-info)',     dot: 'var(--desk-info)',         bg: 'var(--desk-info-bg)',     bd: 'var(--desk-info-border)' },
};

export function StatusPill({ status = 'active', dot = true, height = 26, children, style, ...rest }) {
  const s = STATUS[status] ?? STATUS.active;
  return (
    <span
      style={{
        height,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '0 12px',
        borderRadius: 999,
        background: s.bg,
        border: `1px solid ${s.bd}`,
        color: s.fg,
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {dot && <span style={{ width: 7, height: 7, borderRadius: 999, background: s.dot, flex: 'none' }} />}
      {children}
    </span>
  );
}
