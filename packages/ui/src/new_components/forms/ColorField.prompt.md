`ColorField` and `PresetSwatches` are Brand Settings — the two hexes a tenant stores.

```jsx
<ColorField label="Primary"   value={primary}   onChange={setPrimary} />
<ColorField label="Secondary" value={secondary} onChange={setSecondary} />
<PresetSwatches value={primary} onPick={p => { setPrimary(p.primary); setSecondary(p.secondary); }} />
```

Write the picked values straight onto a wrapper as `--brand-primary` / `--brand-secondary` — everything downstream derives.
