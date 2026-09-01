import React from 'react';

/**
 * Sidebar navigation item. Active state is the pine gradient with the 3px
 * edge marker and pine icon stroke — this is where the old gold accent lived.
 * Only one item is ever active.
 */
export function NavItem({ label, icon, active = false, count, countTone = 'neutral', onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);

  const countTones = {
    neutral: { bg: 'rgba(255,255,255,.1)', fg: '#CBD5E1' },
    pine:    { bg: 'var(--desk-pine-400)', fg: 'var(--desk-sidebar)' },
    danger:  { bg: 'var(--desk-danger)',   fg: '#FFFFFF' },
  };
  const ct = countTones[countTone] ?? countTones.neutral;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        height: 44,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '0 12px',
        borderRadius: 14,
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: 13.5,
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        color: active ? '#FFFFFF' : hover ? '#E2E8F0' : 'var(--desk-text-subtle)',
        background: active
          ? 'var(--desk-nav-active-bg)'
          : hover ? 'var(--desk-sidebar-hover)' : 'transparent',
        boxShadow: active ? 'var(--desk-shadow-nav-active)' : 'none',
        transition: 'background var(--dur-color) ease-out, color var(--dur-color) ease-out',
        ...style,
      }}
      {...rest}
    >
      {active && (
        <span style={{
          position: 'absolute', left: 0, top: 12, width: 3, height: 20,
          borderRadius: '0 3px 3px 0', background: 'var(--desk-pine-400)',
        }} />
      )}
      <span style={{ display: 'flex', flex: 'none', color: active ? 'var(--desk-pine-400)' : 'currentColor' }}>{icon}</span>
      {label}
      {count != null && (
        <span style={{
          marginLeft: 'auto', height: 20, display: 'flex', alignItems: 'center',
          padding: '0 8px', borderRadius: 999,
          background: ct.bg, color: ct.fg, fontSize: 10.5, fontWeight: 800,
        }}>{count}</span>
      )}
    </button>
  );
}
