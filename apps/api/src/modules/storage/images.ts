/**
 * Image checks for anything we store and serve publicly (spec §6.1 photo
 * back-fill). The declared type is never trusted on its own: the bytes must
 * say the same thing, so a script or SVG can't be uploaded as a "photo".
 */

export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp';

export const IMAGE_EXTENSIONS: Record<ImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Profile photos and preview images. SVG and GIF are excluded on purpose. */
export const PROFILE_IMAGE_TYPES: readonly ImageType[] = ['image/jpeg', 'image/png', 'image/webp'];

export const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;

/** The type the bytes themselves show, or null. */
export function sniffImageType(bytes: Buffer): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (bytes.length >= 12 && bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export type DecodedImage = { bytes: Buffer; contentType: ImageType; extension: string };

/**
 * A base64 data URL decoded and checked, or the reason it can't be used.
 * Only data URLs: an https link is never fetched by the server.
 */
export function decodeImageDataUrl(
  value: string,
  options: { allowed?: readonly ImageType[]; maxBytes?: number } = {},
): DecodedImage | { problem: 'not-a-data-url' | 'type' | 'size' | 'mismatch' } {
  const allowed = options.allowed ?? PROFILE_IMAGE_TYPES;
  const maxBytes = options.maxBytes ?? MAX_PROFILE_IMAGE_BYTES;

  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(value.trim());
  if (!match) return { problem: 'not-a-data-url' };
  const declared = match[1] as ImageType;
  if (!allowed.includes(declared)) return { problem: 'type' };

  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0 || bytes.length > maxBytes) return { problem: 'size' };
  if (sniffImageType(bytes) !== declared) return { problem: 'mismatch' };
  return { bytes, contentType: declared, extension: IMAGE_EXTENSIONS[declared] };
}
