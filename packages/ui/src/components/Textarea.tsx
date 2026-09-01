// @ts-nocheck
import React from 'react';

/** Multi-line field. Non-resizable by design; 1.6 line-height. */
export function Textarea({ label, optionalLabel, rows = 3, style, wrapperStyle, ...rest }: any) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, ...wrapperStyle }}>
      {label && (
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--desk-text-body)' }}>
          {label}
          {optionalLabel && (
            <span style={{ fontWeight: 500, color: 'var(--desk-text-subtle)' }}> {optionalLabel}</span>
          )}
        </span>
      )}
      <textarea
        rows={rows}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          resize: 'none',
          padding: '12px 14px',
          borderRadius: 14,
          background: focus ? '#FFFFFF' : 'var(--desk-surface)',
          border: `1px solid ${focus ? 'var(--desk-border-strong)' : 'var(--desk-border)'}`,
          boxShadow: focus ? 'var(--desk-focus-ring)' : undefined,
          outline: 'none',
          fontSize: 14,
          fontFamily: 'var(--font-primary)',
          color: 'var(--desk-text)',
          lineHeight: 1.6,
          transition: 'background var(--dur-color) ease-out, border-color var(--dur-color) ease-out',
          ...style,
        }}
        {...rest}
      />
    </label>
  );
}
