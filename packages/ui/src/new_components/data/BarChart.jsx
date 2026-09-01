import React from 'react';

/**
 * The revenue bar row. Current month fills with the tenant primary; prior
 * months use --brand-bar. Heights transition 300ms ease-out.
 */
export function BarChart({
  data = [],
  height = 96,
  gap = 10,
  showValues = false,
  formatValue = v => v,
  style,
  ...rest
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap, ...style }} {...rest}>
      {data.map((d, i) => {
        const current = d.current ?? i === data.length - 1;
        return (
          <div key={d.label + i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, minWidth: 0 }}>
            {showValues && (
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--desk-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {formatValue(d.value)}
              </div>
            )}
            <div style={{
              width: '100%',
              height: Math.max(6, Math.round((d.value / max) * height)),
              borderRadius: showValues ? '10px 10px 4px 4px' : '8px 8px 3px 3px',
              background: current ? 'var(--brand-primary)' : 'var(--brand-bar)',
              transition: 'height var(--dur-bar) ease-out',
            }} />
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--desk-text-subtle)' }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}
