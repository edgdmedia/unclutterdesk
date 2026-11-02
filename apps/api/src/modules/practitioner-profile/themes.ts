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
