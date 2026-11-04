import { brandTokens } from './custom-colour';
/**
 * Profile appearance (spec §6.5): a palette (`themeKey`) and a layout
 * (`layoutKey`), chosen separately; appearance only, never content or order.
 * The keys live here so the API can refuse an unknown one; the token sets
 * live with the renderer and the editor's preview
 * (packages/ui/src/brand/profileThemes.ts), and a contrast test covers each
 * palette there.
 */
export const THEME_KEYS = ['calm', 'warm', 'crisp', 'earth', 'night'] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];
export const DEFAULT_THEME: ThemeKey = 'calm';

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === 'string' && (THEME_KEYS as readonly string[]).includes(value);
}

/** A custom brand colour instead of a palette (Starter and up); the colour is PractitionerProfile.brandColor. */
export const CUSTOM_THEME = 'custom';

/** A palette key or 'custom': what a profile may store in themeKey. */
export function isThemeChoice(value: unknown): value is ThemeKey | typeof CUSTOM_THEME {
  return value === CUSTOM_THEME || isThemeKey(value);
}

/** `clinical` became `crisp` (Therapysts design system, 4 Nov 2026); the old key is accepted for one release. */
export function normaliseThemeKey(value: unknown): unknown {
  return value === 'clinical' ? 'crisp' : value;
}

export const LAYOUT_KEYS = ['classic', 'editorial', 'compact', 'split'] as const;
export type LayoutKey = (typeof LAYOUT_KEYS)[number];
export const DEFAULT_LAYOUT: LayoutKey = 'classic';

export function isLayoutKey(value: unknown): value is LayoutKey {
  return typeof value === 'string' && (LAYOUT_KEYS as readonly string[]).includes(value);
}

/**
 * Palette colours for things the API draws itself (preview images, the
 * profile PDF). They mirror `colors` in packages/ui/src/brand/profileThemes.ts,
 * which the API can't import; themes.spec.ts reads that file and fails if the
 * two ever differ.
 */
export interface ThemePalette {
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  accent: string;
  accentText: string;
  soft: string;
  border: string;
}

export const THEME_PALETTES: Record<ThemeKey, ThemePalette> = {
  calm: { background: '#F7FAFE', surface: '#FFFFFF', text: '#0F1B33', mutedText: '#4A5876', accent: '#2A56A8', accentText: '#FFFFFF', soft: '#E9F0FB', border: '#E3EAF5' },
  warm: { background: '#FBF6F1', surface: '#FFFFFF', text: '#2A1D15', mutedText: '#5B4A3E', accent: '#8A5A3C', accentText: '#FFFFFF', soft: '#F3EAE3', border: '#E3D2C4' },
  crisp: { background: '#FFFFFF', surface: '#FFFFFF', text: '#111827', mutedText: '#4B5563', accent: '#334155', accentText: '#FFFFFF', soft: '#F1F5F9', border: '#E2E8F0' },
  earth: { background: '#F5F3EA', surface: '#FFFFFF', text: '#23261C', mutedText: '#55594A', accent: '#56622A', accentText: '#FFFFFF', soft: '#E9EBD9', border: '#DEDFCB' },
  night: { background: '#0F1B33', surface: '#16264A', text: '#F1F5F9', mutedText: '#CBD5E1', accent: '#8FB6EC', accentText: '#0F1B33', soft: '#1E3F7A', border: '#24365E' },
};

/** The palette for a stored theme key, falling back to the default. */
export function themePalette(key: string | null | undefined, brandColor?: string | null): ThemePalette {
  if (key === CUSTOM_THEME) {
    const accent = brandTokens(brandColor);
    const calm = THEME_PALETTES.calm;
    return accent ? { ...calm, accent: accent.accent, accentText: accent.accentText, soft: accent.soft } : calm;
  }
  const k = normaliseThemeKey(key);
  return THEME_PALETTES[isThemeKey(k) ? k : DEFAULT_THEME];
}
