import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROFILE_LAYOUTS, PROFILE_THEMES, profileLayout, profileTheme } from '../profileThemes';
import { contrastRatio } from '../tenantBrandStyle';

describe('profile themes (§6.5)', () => {
  it('offers the five v2 presets, calm first as the default', () => {
    expect(PROFILE_THEMES.map((t) => t.key)).toEqual(['calm', 'warm', 'crisp', 'earth', 'night']);
    expect(profileTheme('nope').key).toBe('calm');
  });

  it('offers the four layouts, classic first as the default', () => {
    expect(PROFILE_LAYOUTS.map((l) => l.key)).toEqual(['classic', 'editorial', 'compact', 'split']);
    expect(profileLayout('nope').key).toBe('classic');
  });

  it('match the keys the API accepts', () => {
    const api = readFileSync(resolve(__dirname, '../../../../../apps/api/src/modules/practitioner-profile/themes.ts'), 'utf8');
    const keysOf = (name: string) => new RegExp(`${name} = \\[([^\\]]+)\\]`).exec(api)![1].match(/'([a-z]+)'/g)!.map((k) => k.slice(1, -1));
    expect(keysOf('THEME_KEYS')).toEqual(PROFILE_THEMES.map((t) => t.key));
    expect(keysOf('LAYOUT_KEYS')).toEqual(PROFILE_LAYOUTS.map((l) => l.key));
  });

  describe.each(PROFILE_THEMES.map((t) => [t.key, t] as const))('%s passes WCAG 2.1 AA', (_key, theme) => {
    const c = theme.colors;
    it.each([
      ['text on background', c.text, c.background],
      ['text on surface', c.text, c.surface],
      ['muted text on background', c.mutedText, c.background],
      ['muted text on surface', c.mutedText, c.surface],
      ['accent text (links) on background', c.accent, c.background],
      ['accent text (links) on surface', c.accent, c.surface],
      ['button label on accent', c.accentText, c.accent],
      ['chip text on soft fill', c.text, c.soft],
    ])('%s', (_pair, fg, bg) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  });
});

describe('the old clinical palette', () => {
  it('is read as crisp', async () => {
    const { profileTheme } = await import('../profileThemes');
    expect(profileTheme('clinical').key).toBe('crisp');
  });
});
