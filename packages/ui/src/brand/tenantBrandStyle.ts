type RGB = [number, number, number];

const DEFAULT_PRIMARY = '#0F3A53';
const DEFAULT_SECONDARY = '#E3B341';

function parse(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: RGB): string {
  return `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function luminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #RRGGBB colours. */
export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [parse(a), parse(b)].map((c) => (c ? luminance(c) : 0));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Mixes towards black until the colour reads at 4.5:1 against `background`. */
function darkenAgainst(rgb: RGB, background: string): RGB {
  let c = rgb;
  for (let i = 0; i < 60 && contrastRatio(toHex(c), background) < 4.5; i++) {
    c = c.map((v) => v * 0.9) as RGB;
  }
  return c;
}

const rgba = ([r, g, b]: RGB, a: number) => `rgba(${r}, ${g}, ${b}, ${a})`;

/**
 * A practice's colours as the CSS slots the booking pages read. Dark brands
 * keep their colour for text ("ink") with white on their buttons; light ones
 * get a darkened ink so links and initials stay readable, and dark text on
 * their buttons.
 */
export function tenantBrandStyle(primary: string, secondary: string): Record<string, string> {
  const p = parse(primary) ?? (parse(DEFAULT_PRIMARY) as RGB);
  const s = parse(secondary) ?? (parse(DEFAULT_SECONDARY) as RGB);
  const primaryHex = toHex(p);
  const whiteReads = contrastRatio('#FFFFFF', primaryHex) >= 4.5;
  return {
    '--brand-primary': primaryHex,
    '--brand-secondary': toHex(s),
    '--brand-on-primary': whiteReads ? '#FFFFFF' : toHex(darkenAgainst(p, primaryHex)),
    '--brand-ink': whiteReads ? primaryHex : toHex(darkenAgainst(p, '#FFFFFF')),
    '--brand-ring': rgba(p, 0.2),
    '--brand-tint': rgba(p, 0.08),
    '--brand-fill': rgba(p, 0.09),
    '--brand-dot': rgba(p, 0.4),
    '--brand-secondary-tint': rgba(s, 0.1),
  };
}
