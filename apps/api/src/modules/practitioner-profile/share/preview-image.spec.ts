import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PNG_SIGNATURE_FOR_TESTS, clip, renderPreviewPng } from './preview-image';

/** A real 2 × 2 PNG, so the photo path is exercised without any network. */
const PHOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');

const base = {
  name: 'Dr. Folake Adeyemi',
  kindLabel: 'Clinical Psychologist',
  headline: 'Helping adults through anxiety, burnout and big life changes, with care that fits real life.',
  place: 'Lekki, Lagos · Nigeria',
  address: 'therapysts.com/folake',
  initials: 'FA',
};

const size = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });

describe('link-preview images (§6.3)', () => {
  it.each([
    ['classic', 'calm', PHOTO],
    ['editorial', 'warm', PHOTO],
    ['compact', 'night', null],
    ['split', 'earth', PHOTO],
    ['unknown', 'nope', null],
  ] as const)('renders a 1200 × 630 PNG for %s in %s', async (layoutKey, themeKey, photo) => {
    const png = await renderPreviewPng({ ...base, layoutKey, themeKey, photo });
    expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE_FOR_TESTS);
    expect(size(png)).toEqual({ width: 1200, height: 630 });
    const out = process.env.PREVIEW_OUT;
    if (out) {
      mkdirSync(out, { recursive: true });
      writeFileSync(join(out, `${layoutKey}-${themeKey}.png`), png);
    }
  });

  it('copes with very long text and no headline', async () => {
    const png = await renderPreviewPng({ ...base, name: 'A'.repeat(90), headline: null, place: null, layoutKey: 'classic', themeKey: 'calm', photo: null });
    expect(size(png)).toEqual({ width: 1200, height: 630 });
  });

  it('clips on a word boundary with an ellipsis', () => {
    expect(clip('one two three four', 11)).toBe('one two…');
    expect(clip('short', 20)).toBe('short');
  });
});
