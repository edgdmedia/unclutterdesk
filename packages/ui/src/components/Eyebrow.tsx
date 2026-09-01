// @ts-nocheck
import React from 'react';

/**
 * The 9px / 900 / 0.22em uppercase label that sits above nearly every card
 * and section. The system's most distinctive type signature.
 */
export function Eyebrow({ tone = 'subtle', children, style, ...rest }: any) {
  const colors = {
    subtle: 'var(--desk-text-subtle)',
    muted: 'var(--desk-text-muted)',
    tenant: 'var(--brand-primary)',
    invert: 'rgba(255,255,255,.75)',
  };
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 900,
        textTransform: 'uppercase',
        letterSpacing: '0.22em',
        lineHeight: 1,
        color: colors[tone],
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
