import React from 'react';

const MARK = 'assets/unclutterdesk-mark.svg';

/**
 * The Unclutter Desk mark and lockup. `assetBase` is the relative path from
 * the consuming page to the design system root — the SVGs live in assets/.
 *
 * The "unclutter" wordmark is deliberately shared with the wider Unclutter
 * family; the DESK badge is what makes it this product. The badge is mint
 * (--desk-pine-200 on --desk-pine-900), never gold.
 */
export function Logo({ variant = 'lockup', size = 30, assetBase = '', onDark = true, style, ...rest }) {
  const src = `${assetBase}${MARK}`;

  if (variant === 'mark') {
    return (
      <img src={src} alt="Unclutter Desk" width={size} height={size}
           style={{ borderRadius: Math.round(size * 0.3), display: 'block', ...style }} {...rest} />
    );
  }

  if (variant === 'poweredBy') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }} {...rest}>
        <img src={src} alt="" width={16} height={16} style={{ borderRadius: 5, opacity: 0.6, display: 'block' }} />
        <span style={{ fontSize: 10.5, color: 'var(--desk-text-subtle)' }}>Booking powered by Unclutter Desk</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, ...style }} {...rest}>
      <img src={src} alt="" width={size} height={size}
           style={{ borderRadius: Math.round(size * 0.3), display: 'block' }} />
      <span style={{
        fontSize: Math.round(size * 0.57),
        fontWeight: 600,
        letterSpacing: '-0.02em',
        color: onDark ? '#F8FAFC' : 'var(--desk-pine-800)',
      }}>unclutter</span>
      <span style={{
        height: 18,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 8px',
        borderRadius: 999,
        background: 'var(--desk-pine-200)',
        color: 'var(--desk-pine-900)',
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: '0.08em',
      }}>DESK</span>
    </div>
  );
}
