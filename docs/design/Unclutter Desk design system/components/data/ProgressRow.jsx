import React from 'react';

const TONES = {
  tenant: 'var(--brand-primary)',
  secondary: 'var(--brand-secondary)',
  muted: 'var(--desk-text-subtle)',
};

/**
 * Session-mix / referral-source row: name, count, right-aligned percentage,
 * and a 10px track with a filled bar.
 */
export function ProgressRow({ label, meta, percent = 0, tone = 'tenant', track = true, style, ...rest }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }} {...rest}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--desk-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {meta && <span style={{ fontSize: 12, color: 'var(--desk-text-subtle)' }}>{meta}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 13.5, fontWeight: 800, color: 'var(--desk-text)', fontVariantNumeric: 'tabular-nums' }}>
          {percent}%
        </span>
      </div>
      {track && (
        <div style={{ height: 10, borderRadius: 999, background: 'var(--desk-surface-muted)', overflow: 'hidden' }}>
          <div style={{
            width: `${Math.min(100, Math.max(0, percent))}%`,
            height: '100%',
            borderRadius: 999,
            background: TONES[tone] ?? TONES.tenant,
            transition: 'width var(--dur-bar) ease-out',
          }} />
        </div>
      )}
    </div>
  );
}
