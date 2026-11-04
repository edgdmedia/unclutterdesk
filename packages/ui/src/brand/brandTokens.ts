/**
 * A custom brand colour (design system: "Custom brand colour"; spec §6.5).
 *
 * The colour becomes the accent only; ground, text and body stay Calm's. The
 * accent is darkened in lightness, keeping its hue, until it reads at 4.5:1 or
 * better as text on the page ground and on cards, which also makes white
 * button text pass. `soft` is the accent at low strength on the ground, with
 * ink text on it. One function for the editor's preview, the profile page and
 * the booking flow; the API keeps a copy (custom-colour.ts) that proves the
 * same answers against brandTokens.vectors.json.
 */
import { contrastRatio } from './tenantBrandStyle';

export interface BrandAccent {
  accent: string;
  accentText: string;
  soft: string;
  /** True when the accent had to change to be readable. */
  adjusted: boolean;
}

/** Calm's ground, card and ink: what a custom accent sits on (Therapysts design system). */
export const CUSTOM_BASE = { background: '#F7FAFE', surface: '#FFFFFF', text: '#0F1B33' } as const;
const AA = 4.5;
const SOFT_STRENGTH = 0.12;

const HEX = /^#?([0-9a-f]{6})$/i;

export function normaliseHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = HEX.exec(value.trim());
  return m ? `#${m[1].toUpperCase()}` : null;
}

type RGB = [number, number, number];
const toRgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const toHex = (rgb: RGB) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rr ? ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6 : max === gg ? ((bb - rr) / d + 2) / 6 : ((rr - gg) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb([h, s, l]: [number, number, number]): RGB {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const readable = (hex: string) => contrastRatio(hex, CUSTOM_BASE.background) >= AA && contrastRatio(hex, CUSTOM_BASE.surface) >= AA;

export function brandTokens(input: unknown): BrandAccent | null {
  const hex = normaliseHex(input);
  if (!hex) return null;
  let accent = hex;
  if (!readable(accent)) {
    const [h, s, l] = rgbToHsl(toRgb(hex));
    // Lower the lightness in small steps; the hue stays the brand's.
    for (let next = l; next >= 0; next -= 0.01) {
      accent = toHex(hslToRgb([h, s, Math.max(0, next)]));
      if (readable(accent)) break;
    }
  }
  const [br, bg, bb] = toRgb(CUSTOM_BASE.background);
  const [ar, ag, ab] = toRgb(accent);
  const soft = toHex([br + (ar - br) * SOFT_STRENGTH, bg + (ag - bg) * SOFT_STRENGTH, bb + (ab - bb) * SOFT_STRENGTH]);
  return { accent, accentText: '#FFFFFF', soft, adjusted: accent !== hex };
}
