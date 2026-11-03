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
 * Values come from the approved design (design canvas "Therapysts.com design",
 * 3 Nov 2026), built on the Unclutter Desk design system: pine, clay, slate.
 * Every palette passes WCAG 2.1 AA (profileThemes.test.ts).
 */

export type ProfileThemeKey = 'calm' | 'warm' | 'clinical' | 'earth' | 'night';
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
    description: 'Pine green and plenty of space. The default.',
    colors: { background: '#F6FAF8', surface: '#FFFFFF', text: '#0F172A', mutedText: '#475569', accent: '#24614F', accentText: '#FFFFFF', soft: '#DDEDE6', border: '#E2E8F0' },
  },
  {
    key: 'warm',
    label: 'Warm',
    description: 'Cream and clay, friendly and personal.',
    colors: { background: '#FBF6F1', surface: '#FFFFFF', text: '#2A1D15', mutedText: '#5B4A3E', accent: '#8A5A3C', accentText: '#FFFFFF', soft: '#F3EAE3', border: '#E3D2C4' },
  },
  {
    key: 'clinical',
    label: 'Clinical',
    description: 'Crisp white and deep blue, precise and professional.',
    colors: { background: '#F8FAFC', surface: '#FFFFFF', text: '#0F172A', mutedText: '#475569', accent: '#1D4E89', accentText: '#FFFFFF', soft: '#E6EEF8', border: '#E2E8F0' },
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
    description: 'Deep slate with a soft green accent, calm after dark.',
    colors: { background: '#0F172A', surface: '#17233A', text: '#F1F5F9', mutedText: '#CBD5E1', accent: '#7DB8A5', accentText: '#0E2A22', soft: '#1C3A33', border: '#22324D' },
  },
];

export const DEFAULT_PROFILE_THEME: ProfileThemeKey = 'calm';

export function profileTheme(key: string | null | undefined): ProfileTheme {
  return PROFILE_THEMES.find((t) => t.key === key) ?? PROFILE_THEMES[0];
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
