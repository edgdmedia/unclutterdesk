import React from 'react';

const TONES = {
  neutral: { bg: 'var(--desk-surface-muted)', fg: 'var(--desk-text-muted)' },
  pine:    { bg: 'var(--desk-pine-100)',      fg: 'var(--desk-pine-700)' },
  mint:    { bg: 'var(--desk-pine-200)',      fg: 'var(--desk-pine-900)' },
  tenant:  { bg: 'var(--brand-fill)',         fg: 'var(--brand-primary)' },
  tenantSolid: { bg: 'var(--brand-primary)',  fg: 'var(--brand-on-primary)' },
  secondary:   { bg: 'var(--brand-secondary-tint)', fg: 'var(--brand-secondary)' },
  dark:    { bg: 'var(--desk-sidebar)',       fg: '#fff' },
};

/**
 * Uppercase pill — WHITE-LABEL, SELECTED, MOST BOOKED, CLINICAL PSYCHOLOGY,
 * and the DESK badge in the sidebar lockup.
 */
export function Badge({ tone = 'neutral', height = 22, children, style, ...rest }) {
  const t = TONES[tone] ?? TONES.neutral;
  return (
    <span
      style={{
        height,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 10px',
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
