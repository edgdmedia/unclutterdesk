import React from 'react';

/**
 * A square icon-only control. Used for copy buttons, calendar prev/next,
 * row overflow menus and the header notification bell.
 */
export function IconButton({
  size = 40,
  variant = 'outline',
  radius,
  dot = false,
  disabled = false,
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);

  const variants = {
    outline: {
      background: hover ? 'var(--desk-surface-muted)' : 'var(--desk-card)',
      border: '1px solid var(--desk-border)',
      color: 'var(--desk-text)',
    },
    plain: {
      background: hover ? 'var(--desk-border)' : 'var(--desk-card)',
      border: '1px solid transparent',
      boxShadow: '0 1px 2px rgba(15,23,42,.08)',
      color: 'var(--desk-text)',
    },
    muted: {
      background: hover ? 'var(--desk-border)' : 'var(--desk-surface-muted)',
      border: '1px solid transparent',
      color: 'var(--desk-text-muted)',
    },
    tenant: {
      background: 'var(--brand-primary)',
      border: '1px solid transparent',
      color: 'var(--brand-on-primary)',
      filter: hover ? 'brightness(1.08)' : undefined,
    },
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        width: size,
        height: size,
        flex: 'none',
        borderRadius: radius ?? (size >= 40 ? 14 : 10),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background var(--dur-color) ease-out',
        ...variants[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
      {dot && (
        <span style={{
          position: 'absolute', top: 9, right: 9, width: 7, height: 7,
          borderRadius: 999, background: 'var(--desk-danger)',
          border: '1.5px solid #fff',
        }} />
      )}
    </button>
  );
}
