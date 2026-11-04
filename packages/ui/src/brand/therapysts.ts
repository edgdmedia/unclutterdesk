/**
 * The Therapysts design system's tokens, from ./tokens.json (copied unchanged
 * from the design system). therapysts.test.ts keeps the two equal. Use these,
 * never raw hex values.
 */
export type ThemeMode = 'light' | 'dark';

export const THERAPYSTS_COLORS = {
  "bg": {
    "light": "#FFFFFF",
    "dark": "#0B1426"
  },
  "bg-alt": {
    "light": "#F7FAFE",
    "dark": "#0F1B33"
  },
  "surface": {
    "light": "#FFFFFF",
    "dark": "#16264A"
  },
  "surface-tint": {
    "light": "#E9F0FB",
    "dark": "#1E3F7A"
  },
  "border": {
    "light": "#E3EAF5",
    "dark": "#24365E"
  },
  "border-control": {
    "light": "#7384A6",
    "dark": "#5A6F9E"
  },
  "ink": {
    "light": "#0F1B33",
    "dark": "#F1F5F9"
  },
  "ink-muted": {
    "light": "#4A5876",
    "dark": "#C9D6EA"
  },
  "primary": {
    "light": "#2A56A8",
    "dark": "#8FB6EC"
  },
  "primary-hover": {
    "light": "#1E3F7A",
    "dark": "#B3CEF3"
  },
  "on-primary": {
    "light": "#FFFFFF",
    "dark": "#0F1B33"
  },
  "navy": {
    "light": "#1E3F7A",
    "dark": "#1E3F7A"
  },
  "ink-band": {
    "light": "#0F1B33",
    "dark": "#1E3F7A"
  },
  "on-band": {
    "light": "#F7FAFE",
    "dark": "#F1F5F9"
  },
  "sky": {
    "light": "#8FB6EC",
    "dark": "#8FB6EC"
  },
  "sand": {
    "light": "#E9DCC8",
    "dark": "#E9DCC8"
  },
  "success": {
    "light": "#1F7A4D",
    "dark": "#4CC38A"
  },
  "warning": {
    "light": "#8A5A00",
    "dark": "#F2C14E"
  },
  "warning-soft": {
    "light": "#FFF4D6",
    "dark": "#3A2E0C"
  },
  "danger": {
    "light": "#B42318",
    "dark": "#F97066"
  }
} as const;

export type TherapystsColor = keyof typeof THERAPYSTS_COLORS;

export const THERAPYSTS_FONTS = {
  serif: "Fraunces, Georgia, \"Times New Roman\", serif",
  sans: "Figtree, system-ui, -apple-system, \"Segoe UI\", sans-serif",
} as const;

export const THERAPYSTS_SPACING = {
  "space-1": "4px",
  "space-2": "8px",
  "space-3": "12px",
  "space-4": "16px",
  "space-6": "24px",
  "space-8": "32px",
  "space-12": "48px",
  "space-20": "80px"
} as const;
export const THERAPYSTS_RADIUS = {
  "radius-sm": "12px",
  "radius-md": "16px",
  "radius-lg": "24px",
  "radius-xl": "28px",
  "radius-pill": "999px"
} as const;
export const THERAPYSTS_SHADOW = {
  "shadow-card": {
    "light": "0 24px 60px rgba(15,27,51,0.10)",
    "dark": "0 24px 60px rgba(0,0,0,0.45)"
  },
  "shadow-pop": {
    "light": "0 18px 44px rgba(15,27,51,0.14)",
    "dark": "0 18px 44px rgba(0,0,0,0.5)"
  }
} as const;

/** CSS custom properties for one mode: --ds-<token>. */
export function therapystsCssVars(mode: ThemeMode = 'light'): string {
  const lines = Object.entries(THERAPYSTS_COLORS).map(([name, v]) => `--ds-${name}:${v[mode]};`);
  for (const [name, v] of Object.entries(THERAPYSTS_RADIUS)) lines.push(`--ds-${name}:${v};`);
  for (const [name, v] of Object.entries(THERAPYSTS_SPACING)) lines.push(`--ds-${name}:${v};`);
  for (const [name, v] of Object.entries(THERAPYSTS_SHADOW)) lines.push(`--ds-${name}:${v[mode]};`);
  lines.push(`--ds-font-serif:${THERAPYSTS_FONTS.serif};`, `--ds-font-sans:${THERAPYSTS_FONTS.sans};`);
  return lines.join('');
}
