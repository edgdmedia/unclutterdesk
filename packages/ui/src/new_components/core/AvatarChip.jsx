import React from 'react';

const TONES = {
  tenant:    { bg: 'var(--brand-fill)',            fg: 'var(--brand-primary)' },
  secondary: { bg: 'var(--brand-secondary-tint)',  fg: 'var(--brand-secondary)' },
  pine:      { bg: 'var(--desk-pine-100)',         fg: 'var(--desk-pine-700)' },
  slate:     { bg: 'var(--desk-pine-700)',         fg: '#FFFFFF' },
  muted:     { bg: 'var(--desk-surface-muted)',    fg: 'var(--desk-text-muted)' },
};

/**
 * Initials in a rounded square. There is no photography anywhere in Desk —
 * real implementations render an uploaded photo when present and fall back
 * to these initials.
 */
export function AvatarChip({
  initials = '',
  size = 38,
  tone = 'tenant',
  radius,
  online = false,
  ring = false,
  style,
  ...rest
}) {
  const t = TONES[tone] ?? TONES.tenant;
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flex: 'none',
        borderRadius: radius ?? (size >= 70 ? 24 : size >= 44 ? 14 : 12),
        background: t.bg,
        color: t.fg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: Math.max(11, Math.round(size * 0.32)),
        letterSpacing: '-0.01em',
        boxShadow: ring ? '0 0 0 3px var(--brand-ring)' : undefined,
        ...style,
      }}
      {...rest}
    >
      {initials}
      {online && (
        <span style={{
          position: 'absolute', bottom: -3, right: -3,
          width: 24, height: 24, borderRadius: 999,
          background: 'var(--desk-active-dot)', border: '3px solid #fff',
        }} />
      )}
    </div>
  );
}
