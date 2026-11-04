import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CUSTOM_BASE, brandTokens, normaliseHex } from '../brandTokens';
import { profileTheme } from '../profileThemes';
import { contrastRatio } from '../tenantBrandStyle';

const vectors = JSON.parse(readFileSync(resolve(__dirname, '../brandTokens.vectors.json'), 'utf8'));

describe('a custom brand colour', () => {
  it.each(vectors.inputs as string[])('%s is always readable: accent text, button text and ink on soft', (input) => {
    const t = brandTokens(input)!;
    expect(contrastRatio(t.accent, CUSTOM_BASE.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.accent, CUSTOM_BASE.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.accentText, t.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(CUSTOM_BASE.text, t.soft)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps a colour that already reads, and says when it had to change one', () => {
    expect(brandTokens('#2A56A8')).toMatchObject({ accent: '#2A56A8', adjusted: false });
    const yellow = brandTokens('#FFEB3B')!;
    expect(yellow.adjusted).toBe(true);
    expect(yellow.accent).not.toBe('#FFEB3B');
  });

  it('keeps the hue when it adjusts (still yellow-ish, not grey)', () => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(brandTokens('#FFEB3B')!.accent.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(b);
    expect(g).toBeGreaterThan(b);
  });

  it('returns null for anything that is not a 6-digit hex', () => {
    for (const bad of ['red', '#FFF', '#GGGGGG', '', null, 42]) expect(brandTokens(bad)).toBeNull();
    expect(normaliseHex(' e76f51 ')).toBe('#E76F51');
  });

  it('gives a custom profile Calm with the readable accent', () => {
    const t = profileTheme('custom', '#FFEB3B');
    expect(t.colors.background).toBe(profileTheme('calm').colors.background);
    expect(t.colors.accent).toBe(brandTokens('#FFEB3B')!.accent);
    expect(profileTheme('custom', 'nonsense').key).toBe('calm');
  });

  it('matches the recorded outputs the API copy also checks', () => {
    const recorded = JSON.parse(readFileSync(resolve(__dirname, '../brandTokens.expected.json'), 'utf8'));
    for (const input of vectors.inputs as string[]) expect(brandTokens(input), input).toEqual(recorded[input]);
  });
});
