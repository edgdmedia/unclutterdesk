import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { brandTokens } from './custom-colour';
import { THEME_PALETTES, themePalette } from './themes';

/* The API's copy of the custom-colour rule gives exactly the UI's recorded answers. */
const ui = resolve(__dirname, '../../../../../packages/ui/src/brand');
const vectors = JSON.parse(readFileSync(`${ui}/brandTokens.vectors.json`, 'utf8'));
const expected = JSON.parse(readFileSync(`${ui}/brandTokens.expected.json`, 'utf8'));

describe('custom brand colour (API copy)', () => {
  it('matches packages/ui for every recorded colour', () => {
    for (const input of vectors.inputs as string[]) expect(brandTokens(input), input).toEqual(expected[input]);
  });

  it('gives a custom profile Calm with the readable accent, and Calm for a missing colour', () => {
    expect(themePalette('custom', '#FFEB3B')).toEqual({ ...THEME_PALETTES.calm, accent: expected['#FFEB3B'].accent, accentText: '#FFFFFF', soft: expected['#FFEB3B'].soft });
    expect(themePalette('custom', null)).toEqual(THEME_PALETTES.calm);
  });
});
