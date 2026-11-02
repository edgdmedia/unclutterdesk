import { RESERVED_SLUGS } from '../tenant/reserved-slugs';

/**
 * Profile handles (spec §6.2). A handle is the path of a public profile at the
 * root of the profiles origin (`<origin>/<handle>`), so it must never collide
 * with a path the site itself uses.
 *
 * The same rules are enforced by the database (the `_handle_format` check in
 * the 20261102120000_practitioner_profiles migration); keep the two in step.
 */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

/** Lowercase, 3–30 characters, [a-z0-9-], no leading or trailing hyphen. */
export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

/** Paths of the profiles site itself (§6.2). */
export const PROFILE_SITE_PATHS = [
  'join', 'search', 'verification', 'specialty', 'language', 'in', 'online', 'terms', 'privacy',
  'report', 'sitemap', 'sitemap.xml', 'robots.txt', 'assets', '_astro', 'api', 'admin', 'directory',
  'clinic', 'claim', 'remove',
] as const;

/**
 * Marketing paths (§6.2). The landing page and profiles will share one domain
 * (§4.1b), so they share one path space: a marketing page and a handle can't
 * both be `/pricing`. handles.spec.ts fails if a landing page isn't covered.
 */
export const MARKETING_PATHS = [
  'pricing', 'features', 'about', 'blog', 'help', 'support', 'contact', 'login', 'signin', 'signup',
  'register', 'start', 'app', 'dashboard', 'careers', 'press', 'legal', 'security', 'status', 'docs',
  'faq', 'for-clinics', 'for-therapists', 'enterprise',
] as const;

/** Every name no profile may hold. Practice slugs' reserved names are included (§6.2). */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  ...RESERVED_SLUGS,
  ...PROFILE_SITE_PATHS,
  ...MARKETING_PATHS,
]);

export type HandleProblem = 'format' | 'reserved';

/** Why a handle can't be used, or null when it's well-formed and not reserved. Doesn't check who holds it. */
export function handleProblem(handle: string): HandleProblem | null {
  if (!HANDLE_PATTERN.test(handle)) return 'format';
  if (RESERVED_HANDLES.has(handle)) return 'reserved';
  return null;
}

export const HANDLE_MESSAGES: Record<HandleProblem | 'taken', string> = {
  format: 'Use 3 to 30 lowercase letters, numbers or hyphens, starting and ending with a letter or number.',
  reserved: 'That name is reserved. Please choose another.',
  taken: 'That name is taken. Please choose another.',
};

/** Input as typed: trimmed and lowercased, nothing else changed (so the check reports what's wrong). */
export function normalizeHandle(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * A handle suggested from a display name: "Dr. Adaeze Okonkwo" -> "adaeze-okonkwo".
 * Titles are dropped; accents are folded; the result is cut to fit. May still
 * be reserved or taken, so the caller checks it like any other.
 */
export function suggestHandle(displayName: string): string {
  const titles = /^(dr|mr|mrs|ms|miss|prof|rev|pastor)\.?\s+/i;
  let name = displayName.trim();
  while (titles.test(name)) name = name.replace(titles, '');
  let handle = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (handle.length > HANDLE_MAX) handle = handle.slice(0, HANDLE_MAX).replace(/-+$/, '');
  if (!handle) return 'therapist';
  if (handle.length < HANDLE_MIN) handle = `${handle}-therapy`;
  return handle;
}
