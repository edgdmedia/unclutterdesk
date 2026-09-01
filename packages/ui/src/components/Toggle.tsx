// @ts-nocheck
import React from 'react';

/**
 * The practice-status switch. Track is success green when on, --desk-border-strong
 * when off; the knob translates 200ms ease-out.
 */
export function Toggle({ checked = false, onChange, width = 60, disabled = false, style, ...rest }: any) {
  const height = Math.round(width * 34 / 60);
  const knob = height - 6;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange && onChange(!checked)}
      style={{
        width,
        height,
        flex: 'none',
        padding: 3,
        borderRadius: 999,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        background: checked ? 'var(--desk-active-dot)' : 'var(--desk-border-strong)',
        transition: 'background var(--dur-toggle) ease-out',
        display: 'flex',
        ...style,
      }}
      {...rest}
    >
      <span style={{
        width: knob,
        height: knob,
        borderRadius: 999,
        background: '#fff',
        boxShadow: '0 2px 6px rgba(15,23,42,.22)',
        transform: checked ? `translateX(${width - knob - 6}px)` : 'translateX(0)',
        transition: 'transform var(--dur-toggle) ease-out',
      }} />
    </button>
  );
}
