import { describe, expect, it } from 'vitest';
import { decodeImageDataUrl, sniffImageType } from './images';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
const dataUrl = (type: string, bytes: Buffer) => `data:${type};base64,${bytes.toString('base64')}`;

describe('image checks', () => {
  it.each([
    ['image/png', PNG],
    ['image/jpeg', JPEG],
    ['image/webp', WEBP],
  ])('accepts a real %s', (type, bytes) => {
    expect(sniffImageType(bytes)).toBe(type);
    expect(decodeImageDataUrl(dataUrl(type, bytes))).toMatchObject({ contentType: type });
  });

  it('refuses a declared type the bytes do not match', () => {
    expect(decodeImageDataUrl(dataUrl('image/png', JPEG))).toEqual({ problem: 'mismatch' });
  });

  it('refuses a script dressed as an image', () => {
    expect(decodeImageDataUrl(dataUrl('image/png', Buffer.from('<script>alert(1)</script>')))).toEqual({ problem: 'mismatch' });
  });

  it.each(['image/svg+xml', 'image/gif', 'text/html'])('refuses %s', (type) => {
    expect(decodeImageDataUrl(dataUrl(type, PNG))).toMatchObject({ problem: expect.stringMatching(/type|not-a-data-url/) });
  });

  it('refuses links: the server never fetches an address it was given', () => {
    expect(decodeImageDataUrl('https://example.com/me.png')).toEqual({ problem: 'not-a-data-url' });
  });

  it('refuses an image over the size limit', () => {
    expect(decodeImageDataUrl(dataUrl('image/png', PNG), { maxBytes: 4 })).toEqual({ problem: 'size' });
  });
});
