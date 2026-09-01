import React from 'react';

/**
 * Single-select control on a muted track. Week/Day/Month, Online/In-person,
 * 30 days/90 days/12 months.
 */
export function SegmentedControl({ options = [], value, onChange, height = 40, style, ...rest }) {
  const active = value ?? options[0];
  return (
    <div
      role="tablist"
      style={{
        height,
        display: 'inline-flex',
        alignItems: 'stretch',
        gap: 2,
        padding: 4,
        borderRadius: 14,
        background: 'var(--desk-surface-muted)',
        ...style,
      }}
      {...rest}
    >
      {options.map(opt => {
        const on = opt === active;
        return (
          <button
            key={opt}
            role="tab"
            aria-selected={on}
            onClick={() => onChange && onChange(opt)}
            style={{
              padding: '0 14px',
              borderRadius: 11,
              border: 'none',
              cursor: 'pointer',
              background: on ? '#FFFFFF' : 'transparent',
              color: on ? 'var(--desk-text)' : 'var(--desk-text-muted)',
              boxShadow: on ? '0 1px 2px rgba(15,23,42,.08)' : 'none',
              fontSize: 13,
              fontWeight: on ? 700 : 600,
              fontFamily: 'var(--font-primary)',
              transition: 'background var(--dur-color) ease-out, color var(--dur-color) ease-out',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
