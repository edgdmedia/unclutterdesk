// @ts-nocheck
import React from 'react';

/** 80px white app header: eyebrow + screen title left, action cluster right. */
export function AppHeader({ eyebrow, title, children, style, ...rest }: any) {
  return (
    <header
      style={{
        height: 80,
        flex: 'none',
        background: 'var(--desk-card)',
        borderBottom: '1px solid var(--desk-border)',
        padding: '0 26px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {eyebrow && (
          <div style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--desk-text-subtle)', lineHeight: 1 }}>
            {eyebrow}
          </div>
        )}
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--desk-text)' }}>{title}</div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>{children}</div>
    </header>
  );
}
