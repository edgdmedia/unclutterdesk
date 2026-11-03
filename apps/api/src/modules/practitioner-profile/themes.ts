/**
 * Profile themes (spec §6.5): appearance only, never content or order. The
 * keys live here so the API can refuse an unknown one; the token sets
 * (colours, fonts, header layout, photo shape) live with the renderer and
 * the editor's preview, and a contrast test covers each of them there.
 */
export const THEME_KEYS = ['calm', 'warm', 'clinical', 'earth', 'night'] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];
export const DEFAULT_THEME: ThemeKey = 'calm';

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === 'string' && (THEME_KEYS as readonly string[]).includes(value);
}

/**
 * The colour tokens the PDF uses, one per theme. They mirror the accent,
 * background, text, muted text, border and accent-text colours in
 * `packages/ui/src/brand/profileThemes.ts`; the API cannot import that React
 * package, so `profile-pdf.spec.ts` reads the UI file and fails if they drift.
 */
export interface ThemePalette {
  accent: string;
  accentText: string;
  background: string;
  text: string;
  mutedText: string;
  border: string;
}

export const THEME_PALETTES: Record<ThemeKey, ThemePalette> = {
  calm: { accent: '#0F3A53', accentText: '#FFFFFF', background: '#F5F8FB', text: '#0F2A3D', mutedText: '#4A6275', border: '#DCE5EC' },
  warm: { accent: '#9C4221', accentText: '#FFFFFF', background: '#FBF6EF', text: '#3A2418', mutedText: '#6B4E3D', border: '#EEDFCF' },
  clinical: { accent: '#0B6E6E', accentText: '#FFFFFF', background: '#FFFFFF', text: '#111B21', mutedText: '#4B5A63', border: '#DDE4E7' },
  earth: { accent: '#4A5D23', accentText: '#FFFFFF', background: '#F3F5EF', text: '#232B1E', mutedText: '#505C46', border: '#DDE3D3' },
  night: { accent: '#E3B341', accentText: '#1A1405', background: '#0E1726', text: '#F1F4F8', mutedText: '#B4C0D0', border: '#26344C' },
};

/** The palette for a stored theme key, falling back to the default theme. */
export function themePalette(key: string | null | undefined): ThemePalette {
  return THEME_PALETTES[isThemeKey(key) ? key : DEFAULT_THEME];
}
