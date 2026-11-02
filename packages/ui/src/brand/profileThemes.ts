/**
 * Public-profile themes (spec §6.5): token sets for colour, type, header
 * layout and photo shape. Appearance only: a theme never changes content or
 * section order. Shared by the editor's live preview and the public page
 * (apps/profiles), so the two always match. The keys must match the API's
 * THEME_KEYS (apps/api/src/modules/practitioner-profile/themes.ts).
 *
 * Every theme passes WCAG 2.1 AA (profileThemes.test.ts): body, muted and
 * accent text at 4.5:1 on their backgrounds, and the accent button's label at
 * 4.5:1 on the accent.
 */

export type ProfileThemeKey = 'calm' | 'warm' | 'clinical' | 'earth' | 'night';

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
    accentText: string;
    border: string;
  };
  /** Self-hosted families only (CSP font-src 'self'). */
  fonts: { heading: string; body: string };
  header: 'banner' | 'centred' | 'split';
  photo: 'circle' | 'rounded' | 'arch';
}

export const PROFILE_THEMES: readonly ProfileTheme[] = [
  {
    key: 'calm',
    label: 'Calm',
    description: 'Soft blues and plenty of space.',
    colors: { background: '#F5F8FB', surface: '#FFFFFF', text: '#0F2A3D', mutedText: '#4A6275', accent: '#0F3A53', accentText: '#FFFFFF', border: '#DCE5EC' },
    fonts: { heading: 'var(--font-primary)', body: 'var(--font-primary)' },
    header: 'banner',
    photo: 'circle',
  },
  {
    key: 'warm',
    label: 'Warm',
    description: 'Cream and terracotta, friendly and personal.',
    colors: { background: '#FBF6EF', surface: '#FFFFFF', text: '#3A2418', mutedText: '#6B4E3D', accent: '#9C4221', accentText: '#FFFFFF', border: '#EEDFCF' },
    fonts: { heading: 'var(--font-primary)', body: 'var(--font-primary)' },
    header: 'centred',
    photo: 'rounded',
  },
  {
    key: 'clinical',
    label: 'Clinical',
    description: 'Crisp white and teal, precise and professional.',
    colors: { background: '#FFFFFF', surface: '#F4F7F8', text: '#111B21', mutedText: '#4B5A63', accent: '#0B6E6E', accentText: '#FFFFFF', border: '#DDE4E7' },
    fonts: { heading: 'var(--font-primary)', body: 'var(--font-primary)' },
    header: 'split',
    photo: 'rounded',
  },
  {
    key: 'earth',
    label: 'Earth',
    description: 'Sage and olive, grounded and natural.',
    colors: { background: '#F3F5EF', surface: '#FFFFFF', text: '#232B1E', mutedText: '#505C46', accent: '#4A5D23', accentText: '#FFFFFF', border: '#DDE3D3' },
    fonts: { heading: 'var(--font-primary)', body: 'var(--font-primary)' },
    header: 'banner',
    photo: 'arch',
  },
  {
    key: 'night',
    label: 'Night',
    description: 'Deep navy with a gold accent, calm after dark.',
    colors: { background: '#0E1726', surface: '#162236', text: '#F1F4F8', mutedText: '#B4C0D0', accent: '#E3B341', accentText: '#1A1405', border: '#26344C' },
    fonts: { heading: 'var(--font-primary)', body: 'var(--font-primary)' },
    header: 'centred',
    photo: 'circle',
  },
];

export const DEFAULT_PROFILE_THEME: ProfileThemeKey = 'calm';

export function profileTheme(key: string | null | undefined): ProfileTheme {
  return PROFILE_THEMES.find((t) => t.key === key) ?? PROFILE_THEMES[0];
}
