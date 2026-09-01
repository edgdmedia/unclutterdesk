import React from 'react';

/**
 * Desk text field. 46px in the booking portal, 44px in the workspace.
 * Focus switches background #F8FAFC → #FFFFFF and border → #94A3B8,
 * plus the tenant focus ring.
 */
export function Input({
  label,
  optionalLabel,
  height = 46,
  icon = null,
  trailing = null,
  readOnly = false,
  muted = false,
  mono = false,
  style,
  wrapperStyle,
  ...rest
}) {
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
      <span style={{
        height,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: trailing ? '0 6px 0 14px' : '0 14px',
        borderRadius: 14,
        background: muted ? 'var(--desk-surface-muted)' : focus ? '#FFFFFF' : 'var(--desk-surface)',
        border: `1px solid ${focus ? 'var(--desk-border-strong)' : 'var(--desk-border)'}`,
        boxShadow: focus ? 'var(--desk-focus-ring)' : undefined,
        transition: 'background var(--dur-color) ease-out, border-color var(--dur-color) ease-out',
      }}>
        {icon && <span style={{ color: 'var(--desk-text-subtle)', display: 'flex', flex: 'none' }}>{icon}</span>}
        <input
          readOnly={readOnly}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: mono ? 12.5 : 14,
            fontFamily: mono ? 'var(--font-mono)' : 'var(--font-primary)',
            fontWeight: mono || readOnly ? 500 : 400,
            color: 'var(--desk-text)',
            ...style,
          }}
          {...rest}
        />
        {trailing}
      </span>
    </label>
  );
}
