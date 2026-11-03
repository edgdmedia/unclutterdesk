/**
 * Profile appearance (spec §6.5): a palette (`themeKey`) and a layout
 * (`layoutKey`), chosen separately; appearance only, never content or order.
 * The keys live here so the API can refuse an unknown one; the token sets
 * live with the renderer and the editor's preview
 * (packages/ui/src/brand/profileThemes.ts), and a contrast test covers each
 * palette there.
 */
export const THEME_KEYS = ['calm', 'warm', 'clinical', 'earth', 'night'] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];
export const DEFAULT_THEME: ThemeKey = 'calm';

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === 'string' && (THEME_KEYS as readonly string[]).includes(value);
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
  calm: { background: '#F6FAF8', surface: '#FFFFFF', text: '#0F172A', mutedText: '#475569', accent: '#24614F', accentText: '#FFFFFF', soft: '#DDEDE6', border: '#E2E8F0' },
  warm: { background: '#FBF6F1', surface: '#FFFFFF', text: '#2A1D15', mutedText: '#5B4A3E', accent: '#8A5A3C', accentText: '#FFFFFF', soft: '#F3EAE3', border: '#E3D2C4' },
  clinical: { background: '#F8FAFC', surface: '#FFFFFF', text: '#0F172A', mutedText: '#475569', accent: '#1D4E89', accentText: '#FFFFFF', soft: '#E6EEF8', border: '#E2E8F0' },
  earth: { background: '#F5F3EA', surface: '#FFFFFF', text: '#23261C', mutedText: '#55594A', accent: '#56622A', accentText: '#FFFFFF', soft: '#E9EBD9', border: '#DEDFCB' },
  night: { background: '#0F172A', surface: '#17233A', text: '#F1F5F9', mutedText: '#CBD5E1', accent: '#7DB8A5', accentText: '#0E2A22', soft: '#1C3A33', border: '#22324D' },
};

/** The palette for a stored theme key, falling back to the default. */
export function themePalette(key: string | null | undefined): ThemePalette {
  return THEME_PALETTES[isThemeKey(key) ? key : DEFAULT_THEME];
}
