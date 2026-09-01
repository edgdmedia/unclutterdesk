// @ts-nocheck
import React from 'react';

const HEIGHTS = { sm: 32, md: 40, lg: 44, xl: 48, cta: 52 };
const RADII   = { sm: 10, md: 14, lg: 14, xl: 14, cta: 16 };
const PAD     = { sm: '0 12px', md: '0 16px', lg: '0 20px', xl: '0 22px', cta: '0 24px' };
const FONT    = { sm: 12.5, md: 13.5, lg: 14, xl: 14.5, cta: 15 };

/**
 * The Desk button. Tenant-colored variants read --brand-primary /
 * --brand-secondary, so an arbitrary tenant hue works with no second token —
 * hover is filter: brightness(1.08) on the element itself.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  icon = null,
  iconAfter = null,
  children,
  style,
  ...rest
}: any) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);

  const base = {
    height: HEIGHTS[size],
    padding: PAD[size],
    borderRadius: RADII[size],
    fontSize: FONT[size],
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    border: '1px solid transparent',
    transition: 'background var(--dur-color) ease-out, box-shadow var(--dur-lift) ease-out, filter var(--dur-color) ease-out',
    width: fullWidth ? '100%' : undefined,
    transform: press && !disabled ? 'translateY(1px)' : undefined,
  };

  const variants = {
    primary: {
      background: 'var(--brand-primary)',
      color: 'var(--brand-on-primary)',
      boxShadow: 'var(--desk-shadow-button)',
      filter: hover && !disabled ? 'brightness(1.08)' : undefined,
    },
    secondary: {
      background: hover && !disabled ? 'var(--desk-surface-muted)' : 'var(--desk-card)',
      color: 'var(--desk-text)',
      borderColor: 'var(--desk-border-strong)',
      fontWeight: 600,
    },
    ghost: {
      background: hover && !disabled ? 'var(--desk-surface-muted)' : 'transparent',
      color: 'var(--desk-text-muted)',
      fontWeight: 600,
    },
    link: {
      background: hover && !disabled ? 'var(--desk-surface-muted)' : 'var(--desk-card)',
      color: 'var(--desk-pine-600)',
      borderColor: 'var(--desk-border-strong)',
      fontWeight: 600,
    },
    danger: {
      background: 'var(--desk-danger)',
      color: '#FFFFFF',
      filter: hover && !disabled ? 'brightness(1.08)' : undefined,
    },
    tenantSoft: {
      background: 'var(--brand-fill)',
      color: 'var(--brand-primary)',
      fontWeight: 700,
    },
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{ ...base, ...(variants as any)[variant], ...style }}
      {...rest}
    >
      {icon}
      {children}
      {iconAfter}
    </button>
  );
}
