import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THERAPYSTS_COLORS } from '../../brand/therapysts';
import { contrastRatio } from '../../brand/tenantBrandStyle';

/*
 * The dashboard's tokens follow the Therapysts design system
 * (docs/superpowers/plans/2026-11-04-dashboard-tokens.md). The --ds-* set is
 * the design system one to one; the older --desk-* names carry its values;
 * every text colour is readable on the surfaces it sits on.
 */
const css = readFileSync(resolve(__dirname, '../colors.css'), 'utf8');
const tokens = new Map([...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)].map((m) => [m[1], m[2].toUpperCase()]));
const v = (name: string) => {
  const value = tokens.get(name);
  if (!value) throw new Error(`--${name} is not a hex token in colors.css`);
  return value;
};
const ds = (name: keyof typeof THERAPYSTS_COLORS) => THERAPYSTS_COLORS[name].light.toUpperCase();

describe('dashboard tokens', () => {
  it('define every design-system colour as --ds-*, with the light value', () => {
    for (const name of Object.keys(THERAPYSTS_COLORS) as (keyof typeof THERAPYSTS_COLORS)[]) {
      expect(v(`ds-${name}`), name).toBe(ds(name));
    }
  });

  it('give the workspace names their design-system values', () => {
    const map: Record<string, keyof typeof THERAPYSTS_COLORS> = {
      'desk-pine-600': 'primary',
      'desk-pine-700': 'primary-hover',
      'desk-pine-100': 'surface-tint',
      'desk-pine-050': 'bg-alt',
      'desk-pine-300': 'sky',
      'desk-sidebar': 'ink-band',
      'desk-sidebar-active': 'navy',
      'desk-surface': 'bg-alt',
      'desk-card': 'surface',
      'desk-border': 'border',
      'desk-border-strong': 'border-control',
      'desk-text': 'ink',
      'desk-text-body': 'ink-muted',
      'desk-active': 'success',
      'desk-pending': 'warning',
      'desk-pending-bg': 'warning-soft',
      'desk-danger': 'danger',
      'desk-info': 'primary',
    };
    for (const [desk, name] of Object.entries(map)) expect(v(desk), desk).toBe(ds(name));
  });

  it('keep every text colour at 4.5:1 or better on its surfaces', () => {
    const surfaces = ['desk-card', 'desk-surface', 'desk-surface-alt', 'desk-surface-muted'];
    for (const text of ['desk-text', 'desk-text-body', 'desk-text-muted', 'desk-text-subtle', 'desk-pine-600']) {
      for (const bg of surfaces) expect(contrastRatio(v(text), v(bg)), `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    for (const status of ['active', 'pending', 'danger', 'info', 'inactive']) {
      expect(contrastRatio(v(`desk-${status}`), v(`desk-${status}-bg`)), status).toBeGreaterThanOrEqual(4.5);
    }
    for (const onDark of ['desk-pine-400', 'desk-pine-300', 'desk-text-invert']) {
      expect(contrastRatio(v(onDark), v('desk-sidebar')), `${onDark} on the sidebar`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio('#FFFFFF', v('desk-pine-600'))).toBeGreaterThanOrEqual(4.5);
  });

  it('give input and secondary-button outlines 3:1 on the card and the app background', () => {
    for (const bg of ['desk-card', 'desk-surface']) expect(contrastRatio(v('desk-border-strong'), v(bg))).toBeGreaterThanOrEqual(3);
  });

  it('carry no pine or slate value from the old palette', () => {
    for (const old of ['#24614F', '#1C4E3F', '#0F172A', '#E2E8F0', '#64748B', '#94A3B8', '#475569']) expect(css.toUpperCase()).not.toContain(old);
  });
});
