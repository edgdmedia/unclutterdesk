import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_KEYS, THEME_PALETTES } from './themes';

/** The API's palette copy must match the design tokens the public page and editor use. */
describe('THEME_PALETTES', () => {
  const ui = readFileSync(resolve(__dirname, '../../../../../packages/ui/src/brand/profileThemes.ts'), 'utf8');

  it.each(THEME_KEYS.map((k) => [k]))('%s matches packages/ui profileThemes', (key) => {
    const block = new RegExp(`key: '${key}'[\\s\\S]*?colors: \\{([^}]+)\\}`).exec(ui);
    expect(block).not.toBeNull();
    const colors = Object.fromEntries([...block![1].matchAll(/(\w+): '(#[0-9A-Fa-f]{6})'/g)].map((m) => [m[1], m[2]]));
    expect(colors).toEqual(THEME_PALETTES[key]);
  });
});

describe('the clinical palette became crisp', () => {
  it('accepts the old key for one release, as crisp', async () => {
    const { normaliseThemeKey, themePalette, THEME_PALETTES } = await import('./themes');
    expect(normaliseThemeKey('clinical')).toBe('crisp');
    expect(themePalette('clinical')).toEqual(THEME_PALETTES.crisp);
  });
});
