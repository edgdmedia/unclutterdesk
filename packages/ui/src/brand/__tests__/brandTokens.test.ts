import { describe, expect, it } from 'vitest';
import { brandTokens } from '../brandTokens';
import { contrastRatio } from '../tenantBrandStyle';

/**
 * brandTokens(hex) derives a palette from one accent colour and every text
 * token meets WCAG 2.1 AA contrast (≥ 4.5:1) on its background.
 */

const SAMPLES = [
  '#0F3A53', // deep blue
  '#E3B341', // gold
  '#24614F', // pine
  '#8A5A3C', // clay
  '#1D4E89', // clinical blue
  '#56622A', // olive
  '#7DB8A5', // soft green
  '#DC2626', // red
  '#F97316', // orange
  '#8B5CF6', // violet
  '#111827', // near black
  '#F8FAFC', // near white
  '#64748B', // slate
  '#10B981', // emerald
];

describe('brandTokens', () => {
  it('accepts hex with or without a leading hash', () => {
    const withHash = brandTokens('#0F3A53');
    const without = brandTokens('0F3A53');
    expect(withHash.accent).toBe('#0F3A53');
    expect(without.accent).toBe('#0F3A53');
  });

  it('throws on an invalid hex', () => {
    expect(() => brandTokens('not-a-colour')).toThrow(/Invalid hex/);
    expect(() => brandTokens('#ZZZZZZ')).toThrow(/Invalid hex/);
    expect(() => brandTokens('#12345')).toThrow(/Invalid hex/);
  });

  it('returns every token', () => {
    const t = brandTokens('#0F3A53');
    expect(t).toEqual({
      accent: '#0F3A53',
      accentText: expect.any(String),
      background: expect.any(String),
      surface: expect.any(String),
      text: expect.any(String),
      mutedText: expect.any(String),
      border: expect.any(String),
      soft: expect.any(String),
    });
  });

  it('keeps the accent unchanged when its text already meets AA', () => {
    const t = brandTokens('#0F3A53');
    expect(t.accent).toBe('#0F3A53');
  });

  it('darkens a light accent so its text meets AA', () => {
    // Gold on white/black is below 4.5, so the accent moves darker.
    const t = brandTokens('#E3B341');
    expect(contrastRatio(t.accent, t.accentText)).toBeGreaterThanOrEqual(4.5);
    expect(t.accent).not.toBe('#E3B341');
  });

  it('lightens a dark accent so its text meets AA', () => {
    const t = brandTokens('#111827');
    expect(contrastRatio(t.accent, t.accentText)).toBeGreaterThanOrEqual(4.5);
  });

  it('every text token meets AA on its background', () => {
    for (const hex of SAMPLES) {
      const t = brandTokens(hex);
      // accentText on accent
      expect(contrastRatio(t.accent, t.accentText)).toBeGreaterThanOrEqual(4.5);
      // text on background
      expect(contrastRatio(t.background, t.text)).toBeGreaterThanOrEqual(4.5);
      // mutedText on background
      expect(contrastRatio(t.background, t.mutedText)).toBeGreaterThanOrEqual(4.5);
      // text on surface
      expect(contrastRatio(t.surface, t.text)).toBeGreaterThanOrEqual(4.5);
      // text on soft
      expect(contrastRatio(t.soft, t.text)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('is deterministic', () => {
    expect(brandTokens('#0F3A53')).toEqual(brandTokens('#0F3A53'));
  });
});