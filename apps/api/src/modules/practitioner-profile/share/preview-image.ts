import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import sharp from 'sharp';
import { themePalette, type ThemePalette } from '../themes';

/**
 * Link-preview images (spec §6.3): the 1200 × 630 card WhatsApp, X, LinkedIn
 * and Facebook show when a profile link is shared. One design per layout, in
 * the profile's palette (design canvas "Link preview image"). Satori lays out
 * the card as SVG; resvg turns it into a PNG. Fonts are read from the
 * installed packages, never fetched; the photo arrives as bytes, never a URL.
 */

export const PREVIEW_WIDTH = 1200;
export const PREVIEW_HEIGHT = 630;

export interface PreviewInput {
  name: string;
  kindLabel: string;
  headline: string | null;
  place: string | null;
  /** Shown bottom right, the profile address without https://. */
  address: string;
  layoutKey: string;
  themeKey: string;
  /** JPEG, PNG or WebP bytes; null draws initials instead. */
  photo: Buffer | null;
  initials: string;
}

type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, ...(children === undefined ? {} : { children }), ...extra },
});

// Therapysts design system: Figtree for text, Fraunces (soft) for the name and
// the editorial pull quote. Static faces, because satori can't read variable fonts.
let fonts: { name: string; data: Buffer; weight: 400 | 500 | 600 | 700 | 800; style: 'normal' | 'italic' }[] | null = null;
function loadFonts() {
  if (fonts) return fonts;
  const dir = (pkg: string) => join(dirname(require.resolve(`${pkg}/package.json`)), 'files');
  const figtree = (w: number) => readFileSync(join(dir('@fontsource/figtree'), `figtree-latin-${w}-normal.woff2`));
  const fraunces = (file: string) => readFileSync(join(dir('@fontsource/fraunces'), file));
  fonts = [
    { name: 'Figtree', data: figtree(400), weight: 400, style: 'normal' },
    { name: 'Figtree', data: figtree(700), weight: 700, style: 'normal' },
    { name: 'Figtree', data: figtree(800), weight: 800, style: 'normal' },
    { name: 'Fraunces', data: fraunces('fraunces-latin-600-normal.woff2'), weight: 600, style: 'normal' },
    { name: 'Fraunces', data: fraunces('fraunces-latin-500-italic.woff2'), weight: 500, style: 'italic' },
  ];
  return fonts;
}

/** Cut text to `max` characters on a word boundary, with an ellipsis. */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), Math.floor(max * 0.6))).trimEnd()}…`;
}

function portrait(input: PreviewInput, c: ThemePalette, size: { width: number; height: number; radius: number }): Node {
  const style = { width: size.width, height: size.height, borderRadius: size.radius };
  if (input.photo) {
    return el('img', { ...style, objectFit: 'cover' }, undefined, { src: `data:image/${sniff(input.photo)};base64,${input.photo.toString('base64')}`, width: size.width, height: size.height });
  }
  return el(
    'div',
    { ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.soft, color: c.accent, fontSize: Math.round(size.height / 3), fontWeight: 800 },
    input.initials || '·',
  );
}

function sniff(bytes: Buffer): 'jpeg' | 'png' | 'webp' {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'png';
  if (bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return 'jpeg';
}

function textBlock(input: PreviewInput, c: ThemePalette, opts: { quote?: boolean; nameSize?: number } = {}): Node {
  const nameSize = opts.nameSize ?? (input.name.length > 22 ? 60 : 76);
  return el('div', { display: 'flex', flexDirection: 'column', gap: 18 }, [
    el('div', { fontSize: 26, fontWeight: 700, color: c.accent }, input.kindLabel),
    el('div', { fontFamily: 'Fraunces', fontSize: nameSize, fontWeight: 600, letterSpacing: -1.5, lineHeight: 1.04 }, clip(input.name, 40)),
    input.headline
      ? opts.quote
        ? el('div', { fontFamily: 'Fraunces', fontStyle: 'italic', fontWeight: 500, fontSize: 34, lineHeight: 1.3 }, `“${clip(input.headline, 110)}”`)
        : el('div', { fontSize: 32, lineHeight: 1.3, color: c.mutedText }, clip(input.headline, 110))
      : el('div', { display: 'flex' }, ''),
  ]);
}

function footer(input: PreviewInput, c: ThemePalette): Node {
  return el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 24, color: c.mutedText }, [
    el('div', {}, input.place ?? ''),
    el('div', { fontWeight: 800, color: c.text, letterSpacing: -0.5 }, input.address),
  ]);
}

function card(input: PreviewInput): Node {
  const c = themePalette(input.themeKey);
  const base = { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, display: 'flex', background: c.background, color: c.text, fontFamily: 'Figtree' };
  const column = (children: Node[], padding = '72px 72px 56px') =>
    el('div', { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding }, children);

  switch (input.layoutKey) {
    case 'editorial':
      return el('div', base, [
        el('div', { width: 460, height: PREVIEW_HEIGHT, display: 'flex' }, [portrait(input, c, { width: 460, height: PREVIEW_HEIGHT, radius: 0 })]),
        column([textBlock(input, c, { quote: true }), footer(input, c)]),
      ]);
    case 'compact':
      return el('div', base, [el('div', { flex: 1, display: 'flex', flexDirection: 'column', padding: '64px 72px 56px', justifyContent: 'space-between' }, [
        el('div', { display: 'flex', alignItems: 'center', gap: 32 }, [
          portrait(input, c, { width: 150, height: 150, radius: 40 }),
          el('div', { display: 'flex', flexDirection: 'column', gap: 10 }, [
            el('div', { fontFamily: 'Fraunces', fontSize: 72, fontWeight: 600, letterSpacing: -1.5, lineHeight: 1.04 }, clip(input.name, 30)),
            el('div', { fontSize: 28, fontWeight: 700, color: c.accent }, input.kindLabel),
          ]),
        ]),
        el('div', { display: 'flex', width: PREVIEW_WIDTH - 144, fontSize: 36, lineHeight: 1.3 }, input.headline ? clip(input.headline, 120) : ''),
        el('div', { display: 'flex', flexDirection: 'column', width: PREVIEW_WIDTH - 144 }, [footer(input, c)]),
      ])]);
    case 'split':
      return el('div', base, [
        column([textBlock(input, c), footer(input, c)], '72px 48px 56px 72px'),
        el('div', { width: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 64px 0 0' }, [
          portrait(input, c, { width: 336, height: 420, radius: 36 }),
        ]),
      ]);
    default:
      return el('div', base, [
        el('div', { width: 440, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.soft }, [
          portrait(input, c, { width: 320, height: 320, radius: 999 }),
        ]),
        column([textBlock(input, c), footer(input, c)]),
      ]);
  }
}

/**
 * The photo as a square JPEG the PNG renderer can draw (it can't decode WebP,
 * the format most uploads arrive in). Unreadable bytes give null, so the card
 * falls back to initials rather than failing.
 */
export async function normalisePhoto(photo: Buffer | null): Promise<Buffer | null> {
  if (!photo?.length) return null;
  try {
    return await sharp(photo).rotate().resize(640, 640, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
  } catch {
    return null;
  }
}

/** Render the card to PNG bytes. */
export async function renderPreviewPng(raw: PreviewInput): Promise<Buffer> {
  const input = { ...raw, photo: await normalisePhoto(raw.photo) };
  const svg = await satori(card(input) as any, { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, fonts: loadFonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: PREVIEW_WIDTH } }).render().asPng());
}

/** The PNG file signature, exported for tests. */
export const PNG_SIGNATURE_FOR_TESTS = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
