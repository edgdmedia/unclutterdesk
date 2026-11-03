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
