import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THERAPYSTS_COLORS, THERAPYSTS_FONTS, THERAPYSTS_RADIUS, THERAPYSTS_SPACING } from '../therapysts';

/* The code's tokens are exactly the design system's (tokens.json, copied unchanged). */
const tokens = JSON.parse(readFileSync(resolve(__dirname, '../therapysts/tokens.json'), 'utf8'));
const byName = (list: Array<{ name: string; value: unknown }>) => Object.fromEntries(list.map((t) => [t.name, t.value]));

describe('Therapysts tokens', () => {
  it('match the design system', () => {
    const colors = byName(tokens.color.tokens);
    for (const [name, value] of Object.entries(THERAPYSTS_COLORS)) expect(value, name).toEqual(typeof colors[name] === 'string' ? { light: colors[name], dark: colors[name] } : colors[name]);
    expect(Object.keys(THERAPYSTS_COLORS).sort()).toEqual(Object.keys(colors).sort());
    expect(THERAPYSTS_SPACING).toEqual(byName(tokens.spacing.tokens));
    expect(THERAPYSTS_RADIUS).toEqual(byName(tokens.radius.tokens));
    expect(THERAPYSTS_FONTS).toEqual(tokens.type.families);
  });
});
