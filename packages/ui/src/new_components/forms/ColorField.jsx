import React from 'react';

/**
 * A tenant brand-color field: native swatch with its chrome removed, a role
 * label, and the uppercase mono hex. Fires on both `input` and `change` so
 * dragging in the picker updates the preview continuously.
 */
export function ColorField({ label = 'Primary', value = '#24614F', onChange, style, ...rest }) {
  const emit = e => onChange && onChange(e.target.value);
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 16,
        background: 'var(--desk-surface)',
        border: '1px solid var(--desk-border)',
        cursor: 'pointer',
        minWidth: 0,
        ...style,
      }}
      {...rest}
    >
      <input
        type="color"
        value={value}
        onInput={emit}
        onChange={emit}
        style={{
          width: 36, height: 36, flex: 'none', padding: 0,
          border: 'none', borderRadius: 10, background: 'none',
          WebkitAppearance: 'none', appearance: 'none', cursor: 'pointer',
        }}
      />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--desk-text-muted)' }}>{label}</span>
        <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600, color: 'var(--desk-text)' }}>
          {String(value).toUpperCase()}
        </span>
      </span>
      <style>{`
        input[type=color]::-webkit-color-swatch-wrapper { padding: 0; }
        input[type=color]::-webkit-color-swatch { border: none; border-radius: 10px; }
      `}</style>
    </label>
  );
}

/**
 * The five preset pairs from Brand Settings, as split swatches.
 * Values are fixed; only the first one's label changed with the rename.
 */
export const BRAND_PRESETS = [
  { name: 'Deep navy',   primary: '#0F3A53', secondary: '#E3B341' },
  { name: 'Signal blue', primary: '#007BFF', secondary: '#6F42C1' },
  { name: 'Calm teal',   primary: '#0E7490', secondary: '#F59E0B' },
  { name: 'Deep violet', primary: '#7C3AED', secondary: '#EC4899' },
  { name: 'Forest',      primary: '#15803D', secondary: '#B45309' },
];

export function PresetSwatches({ value, onPick, size = 30, style }) {
  return (
    <div style={{ display: 'flex', gap: 8, ...style }}>
      {BRAND_PRESETS.map(p => (
        <button
          key={p.name}
          type="button"
          title={p.name}
          aria-label={p.name}
          onClick={() => onPick && onPick(p)}
          style={{
            width: size, height: size, padding: 0, display: 'flex', overflow: 'hidden',
            borderRadius: 10, cursor: 'pointer',
            border: `2px solid ${value === p.primary ? 'var(--desk-text)' : 'var(--desk-border)'}`,
          }}
        >
          <span style={{ flex: 1, background: p.primary }} />
          <span style={{ flex: 1, background: p.secondary }} />
        </button>
      ))}
    </div>
  );
}
