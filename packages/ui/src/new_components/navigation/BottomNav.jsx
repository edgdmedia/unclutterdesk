import React from 'react';

/**
 * The mobile app's frosted bottom navigation. Active tab is a solid slate
 * pill with white icon and label — no icon-only treatment.
 */
export function BottomNav({ items = [], active, onSelect, style, ...rest }) {
  return (
    <nav
      style={{
        height: 92,
        flex: 'none',
        display: 'flex',
        justifyContent: 'space-between',
        padding: '12px 14px 0',
        background: 'var(--desk-glass-bg)',
        backdropFilter: 'var(--desk-glass-blur)',
        WebkitBackdropFilter: 'var(--desk-glass-blur)',
        borderTop: '1px solid var(--desk-glass-border)',
        borderRadius: '24px 24px 0 0',
        ...style,
      }}
      {...rest}
    >
      {items.map(it => {
        const on = (it.key ?? it.label) === active;
        return (
          <button
            key={it.key ?? it.label}
            type="button"
            onClick={() => onSelect && onSelect(it.key ?? it.label)}
            style={{
              height: 52,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '0 14px',
              borderRadius: 16,
              border: 'none',
              cursor: 'pointer',
              background: on ? 'var(--desk-sidebar)' : 'transparent',
              color: on ? '#FFFFFF' : 'var(--desk-text-subtle)',
              fontFamily: 'var(--font-primary)',
              transition: 'background var(--dur-color) ease-out, color var(--dur-color) ease-out',
            }}
          >
            <span style={{ display: 'flex' }}>{it.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 700 }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
