import React from 'react';

const PADS = { none: 0, sm: '18px 20px', md: '22px 24px', lg: '24px 26px' };

/**
 * The workspace surface: white, 24px radius, hairline border, shadow-sm.
 * `hoverable` adds the standard lift — translateY(-1px) + shadow-hover.
 */
export function Card({
  padding = 'lg',
  radius = 24,
  hoverable = false,
  raised = false,
  dark = false,
  style,
  children,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={hoverable ? () => setHover(true) : undefined}
      onMouseLeave={hoverable ? () => setHover(false) : undefined}
      style={{
        background: dark ? 'var(--desk-sidebar)' : 'var(--desk-card)',
        color: dark ? '#fff' : 'var(--desk-text)',
        border: dark ? 'none' : '1px solid var(--desk-border)',
        borderRadius: radius,
        padding: typeof padding === 'string' ? PADS[padding] ?? padding : padding,
        boxShadow: hover
          ? 'var(--desk-shadow-hover)'
          : raised ? 'var(--desk-shadow-lg)' : 'var(--desk-shadow-sm)',
        transform: hover ? 'translateY(-1px)' : undefined,
        transition: 'box-shadow var(--dur-lift) ease-out, transform var(--dur-lift) ease-out',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
