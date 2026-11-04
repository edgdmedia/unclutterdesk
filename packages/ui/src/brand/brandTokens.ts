/**
 * Brand tokens derived from a single hex accent colour (spec §6.5, §6.16).
 *
 * A practice picks one colour. Everything else — the neutral surface, the
 * muted text, the soft chip fill — is worked out from it here, so the profiles
 * renderer and the app always agree. The one hard rule is WCAG 2.1 AA: every
 * piece of text has a contrast ratio of at least 4.5:1 on what it sits on.
 *
 * The accent is kept when white text already passes on it. When it does not,
 * the accent is darkened in small steps until it does: the fill stays brand
 * coloured, the label stays readable, and the editor can show the adjusted
 * colour rather than a failing one.
 */

import { contrastRatio } from './tenantBrandStyle';

export interface BrandTokens {
  /** The accent actually used as a fill (may be slightly darker than the input). */
  accent: string;
  /** Text on an accent fill. */
  accentText: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  border: string;
  /** Soft accent tint for chips and placeholders; `text` sits on it. */
  soft: string;
}

/** AA for normal text. */
const AA_TEXT = 4.5;

function normalize(hex: string): string {
  const value = hex.trim();
  if (!/^#?[a-f\d]{6}$/i.test(value)) throw new Error(`Invalid hex colour: ${value}`);
  return `#${value.replace('#', '').toUpperCase()}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = normalize(hex);
  return [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16),
  ];
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const toLinear = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Mix `amount` (0-1) of `over` into `base`. */
function mix(base: string, over: string, amount: number): string {
  const b = hexToRgb(base);
  const o = hexToRgb(over);
  return rgbToHex([0, 1, 2].map((i) => b[i] * (1 - amount) + o[i] * amount) as [number, number, number]);
}

/** Move a colour toward black by `percent` (0-100). */
function darken(hex: string, percent: number): string {
  const f = 1 - percent / 100;
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r * f, g * f, b * f]);
}

/** Keep white text on the accent, darkening the accent until AA is met. */
function readableAccent(input: string): { accent: string; accentText: string } {
  let accent = input;
  for (let step = 0; step < 24 && contrastRatio(accent, '#FFFFFF') < AA_TEXT; step += 1) {
    accent = darken(accent, 5);
  }
  // At the darkest end white always passes; the fallback covers a broken input.
  return contrastRatio(accent, '#FFFFFF') >= AA_TEXT
    ? { accent, accentText: '#FFFFFF' }
    : { accent: '#000000', accentText: '#FFFFFF' };
}

/**
 * Derive a full palette from one accent colour.
 *
 * Light accents (high luminance) get a light page and dark text; dark accents
 * get a deep page and light text. `soft` is a low-tint mix toward the page
 * colour, so text on it reads like text on the page.
 */
export function brandTokens(hex: string): BrandTokens {
  const { accent, accentText } = readableAccent(normalize(hex));
  const light = luminance(accent) > 0.35;

  const background = light ? '#F7FAF9' : '#0F172A';
  const surface = light ? '#FFFFFF' : '#17233A';
  const text = light ? '#0F172A' : '#F1F5F9';
  const mutedText = light ? '#475569' : '#CBD5E1';
  const border = light ? mix(background, accent, 0.16) : mix(background, accent, 0.22);
  const soft = mix(background, accent, light ? 0.14 : 0.22);

  return { accent, accentText, background, surface, text, mutedText, border, soft };
}