import { describe, expect, it } from 'vitest';
import { profileQr } from './qr';

const URL_UNDER_TEST = 'https://therapysts.example/ada-obi';

describe('profileQr', () => {
  it('renders a valid SVG with no script', async () => {
    const svg = await profileQr(URL_UNDER_TEST, 'svg');
    expect(typeof svg).toBe('string');
    expect(svg as string).toContain('<svg');
    expect(svg as string).toContain('</svg>');
    expect((svg as string).toLowerCase()).not.toContain('<script');
  });

  it('renders a PNG starting with the PNG signature', async () => {
    const png = await profileQr(URL_UNDER_TEST, 'png');
    expect(Buffer.isBuffer(png)).toBe(true);
    const bytes = png as Buffer;
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });

  it('refuses a URL that is not https', async () => {
    await expect(profileQr('http://therapysts.example/ada-obi', 'svg')).rejects.toThrow();
    await expect(profileQr('javascript:alert(1)', 'png')).rejects.toThrow();
    await expect(profileQr('', 'svg')).rejects.toThrow();
  });
});