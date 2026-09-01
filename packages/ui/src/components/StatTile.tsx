// @ts-nocheck
import React from 'react';

/** KPI tile: eyebrow over a tabular value. 20px radius, 16px 18px padding. */
export function StatTile({ label, value, delta, deltaTone = 'active', compact = false, style, ...rest }: any) {
  const tones = {
    active: { bg: 'var(--desk-active-bg)', bd: 'var(--desk-active-border)', fg: 'var(--desk-active)' },
    pending: { bg: 'var(--desk-pending-bg)', bd: 'var(--desk-pending-border)', fg: 'var(--desk-pending)' },
  };
  const t = (tones as any)[deltaTone] ?? tones.active;
  return (
    <div
      style={{
        minWidth: compact ? 96 : undefined,
        padding: compact ? '12px 14px' : '16px 18px',
        borderRadius: compact ? 16 : 20,
        background: compact ? 'var(--desk-surface)' : 'var(--desk-card)',
        border: '1px solid var(--desk-border)',
        boxShadow: compact ? 'none' : 'var(--desk-shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 4 : 8,
        ...style,
      }}
      {...rest}
    >
      {!compact && (
        <div style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--desk-text-subtle)', lineHeight: 1 }}>
          {label}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: compact ? 22 : 26,
          fontWeight: 800,
          letterSpacing: compact ? '-0.03em' : '-0.035em',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--desk-text)',
        }}>{value}</span>
        {delta && (
          <span style={{
            height: 22, display: 'inline-flex', alignItems: 'center', padding: '0 9px',
            borderRadius: 999, background: t.bg, border: `1px solid ${t.bd}`, color: t.fg,
            fontSize: 11.5, fontWeight: 700,
          }}>{delta}</span>
        )}
      </div>
      {compact && (
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--desk-text-muted)' }}>{label}</div>
      )}
    </div>
  );
}
