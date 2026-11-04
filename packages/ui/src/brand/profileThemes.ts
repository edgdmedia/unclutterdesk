/**
 * Public-profile appearance (spec §6.5): two separate choices.
 *
 * - A **palette** (`themeKey`): colour tokens only. PROFILE_THEMES below.
 * - A **layout** (`layoutKey`): structure (header, photo, section arrangement,
 *   type pairing). PROFILE_LAYOUTS below.
 *
 * Any palette works on any layout, and neither changes content or section
 * order. Shared by the editor's live preview and the public page
 * (apps/profiles), so the two always match. Keys must match the API's
 * THEME_KEYS and LAYOUT_KEYS (apps/api/src/modules/practitioner-profile/themes.ts).
 *
 * Values come from the Therapysts design system's profile palette table
 * (adopted 4 Nov 2026). `crisp` replaced `clinical`; profileTheme() still
 * reads an old `clinical` value as `crisp`.
 * Every palette passes WCAG 2.1 AA (profileThemes.test.ts).
 */

export type ProfileThemeKey = 'calm' | 'warm' | 'crisp' | 'earth' | 'night';
export type ProfileLayoutKey = 'classic' | 'editorial' | 'compact' | 'split';

export interface ProfileTheme {
  key: ProfileThemeKey;
  label: string;
  description: string;
  colors: {
    background: string;
    surface: string;
    text: string;
    mutedText: string;
    accent: string;
    /** Text on an accent fill (buttons, primary specialty chips). */
    accentText: string;
    /** Soft accent fill (secondary chips, photo placeholder); text on it is `text`. */
    soft: string;
    border: string;
  };
}

export const PROFILE_THEMES: readonly ProfileTheme[] = [
  {
    key: 'calm',
    label: 'Calm',
    description: 'Blue-white and calm blue. The default.',
    colors: { background: '#F7FAFE', surface: '#FFFFFF', text: '#0F1B33', mutedText: '#4A5876', accent: '#2A56A8', accentText: '#FFFFFF', soft: '#E9F0FB', border: '#E3EAF5' },
  },
  {
    key: 'warm',
    label: 'Warm',
    description: 'Cream and clay, friendly and personal.',
    colors: { background: '#FBF6F1', surface: '#FFFFFF', text: '#2A1D15', mutedText: '#5B4A3E', accent: '#8A5A3C', accentText: '#FFFFFF', soft: '#F3EAE3', border: '#E3D2C4' },
  },
  {
    key: 'crisp',
    label: 'Crisp',
    description: 'White and slate, precise and professional.',
    colors: { background: '#FFFFFF', surface: '#FFFFFF', text: '#111827', mutedText: '#4B5563', accent: '#334155', accentText: '#FFFFFF', soft: '#F1F5F9', border: '#E2E8F0' },
  },
  {
    key: 'earth',
    label: 'Earth',
    description: 'Stone and olive, grounded and natural.',
    colors: { background: '#F5F3EA', surface: '#FFFFFF', text: '#23261C', mutedText: '#55594A', accent: '#56622A', accentText: '#FFFFFF', soft: '#E9EBD9', border: '#DEDFCB' },
  },
  {
    key: 'night',
    label: 'Night',
    description: 'Deep ink with a sky-blue accent, calm after dark.',
    colors: { background: '#0F1B33', surface: '#16264A', text: '#F1F5F9', mutedText: '#CBD5E1', accent: '#8FB6EC', accentText: '#0F1B33', soft: '#1E3F7A', border: '#24365E' },
  },
];

export const DEFAULT_PROFILE_THEME: ProfileThemeKey = 'calm';

export function profileTheme(key: string | null | undefined): ProfileTheme {
  const k = key === 'clinical' ? 'crisp' : key;
  return PROFILE_THEMES.find((t) => t.key === k) ?? PROFILE_THEMES[0];
}

export interface ProfileLayout {
  key: ProfileLayoutKey;
  label: string;
  description: string;
  /** Self-hosted families only (CSP font-src 'self'). */
  fonts: { heading: 'outfit'; quote: 'outfit' | 'fraunces' };
}

export const PROFILE_LAYOUTS: readonly ProfileLayout[] = [
  { key: 'classic', label: 'Classic', description: 'Centred portrait, one column.', fonts: { heading: 'outfit', quote: 'outfit' } },
  { key: 'editorial', label: 'Editorial', description: 'Wide photo, headline as a quote.', fonts: { heading: 'outfit', quote: 'fraunces' } },
  { key: 'compact', label: 'Compact', description: 'Small header, sections as cards.', fonts: { heading: 'outfit', quote: 'outfit' } },
  { key: 'split', label: 'Split', description: 'Fees panel beside the profile.', fonts: { heading: 'outfit', quote: 'outfit' } },
];

export const DEFAULT_PROFILE_LAYOUT: ProfileLayoutKey = 'classic';

export function profileLayout(key: string | null | undefined): ProfileLayout {
  return PROFILE_LAYOUTS.find((l) => l.key === key) ?? PROFILE_LAYOUTS[0];
}
