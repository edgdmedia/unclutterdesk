import { describe, expect, it } from 'vitest';
import { contrastRatio, tenantBrandStyle } from '../tenantBrandStyle';

describe('tenantBrandStyle', () => {
  it.each([
    // The three tenants the design was checked with (README, Design tokens).
    ['#24614F', '#8A5A3C', '#FFFFFF', '#24614F'],
    ['#0F3A53', '#E3B341', '#FFFFFF', '#0F3A53'],
  ])('keeps a dark brand as its own ink, with white on top (%s)', (primary, secondary, onPrimary, ink) => {
    const s = tenantBrandStyle(primary, secondary);
    expect(s['--brand-on-primary']).toBe(onPrimary);
    expect(s['--brand-ink'].toLowerCase()).toBe(ink.toLowerCase());
  });

  it('darkens a light brand into a readable ink, and puts dark text on it', () => {
    const s = tenantBrandStyle('#CDBDF2', '#F2B8A0');
    expect(contrastRatio(s['--brand-ink'], '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(s['--brand-on-primary'], '#CDBDF2')).toBeGreaterThanOrEqual(4.5);
  });

  it('derives the soft fills from the brand', () => {
    const s = tenantBrandStyle('#0F3A53', '#E3B341');
    expect(s['--brand-fill']).toBe('rgba(15, 58, 83, 0.09)');
    expect(s['--brand-ring']).toBe('rgba(15, 58, 83, 0.2)');
    expect(s['--brand-tint']).toBe('rgba(15, 58, 83, 0.08)');
    expect(s['--brand-dot']).toBe('rgba(15, 58, 83, 0.4)');
    expect(s['--brand-secondary-tint']).toBe('rgba(227, 179, 65, 0.1)');
  });

  it('falls back to the Desk default for an invalid colour', () => {
    expect(tenantBrandStyle('not-a-colour', '')['--brand-primary']).toBe('#0F3A53');
  });
});
