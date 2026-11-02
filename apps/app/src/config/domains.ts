/**
 * The app's one domain config (spec §4.1a).
 *
 * Every production address is a build setting, with today's address as its
 * default, so the move to new domains (§4.1b) is a change of settings, not of
 * code. No other app file may spell out a production domain: the API's
 * domain-literals.spec.ts checks the whole repository.
 */

const trimSlash = (value: string) => value.replace(/\/+$/, '');

/** Practice subdomains are `{slug}.<root>`. VITE_TENANT_ROOT_DOMAIN. */
export const TENANT_ROOT_DOMAIN = String(import.meta.env.VITE_TENANT_ROOT_DOMAIN || 'unclutterdesk.com').toLowerCase();

/** The API in production. VITE_API_URL, which also overrides it in development. */
export const PRODUCTION_API_ORIGIN = 'https://api.unclutterdesk.com';

/** The app in production: its own setting, never derived from the root domain. VITE_APP_URL. */
export const PRODUCTION_APP_ORIGIN = trimSlash(String(import.meta.env.VITE_APP_URL || 'https://app.unclutterdesk.com'));

/** The marketing site in production. VITE_MARKETING_URL. */
export const PRODUCTION_MARKETING_ORIGIN = 'https://unclutterdesk.com';

const hostOf = (origin: string) => {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return '';
  }
};

/** The app's own host, e.g. app.<root> today. */
export const APP_HOST = hostOf(PRODUCTION_APP_ORIGIN);

/** The marketing site's host (and its www), where the app is never a practice. */
export const MARKETING_HOST = hostOf(String(import.meta.env.VITE_MARKETING_URL || PRODUCTION_MARKETING_ORIGIN));

/** Public profiles (spec §4.1). VITE_PROFILE_PUBLIC_URL. */
export const PROFILE_PUBLIC_ORIGIN = trimSlash(String(import.meta.env.VITE_PROFILE_PUBLIC_URL || 'https://profiles.unclutterdesk.com'));

/** A profile's public address (spec §6.3): `${PROFILE_PUBLIC_ORIGIN}/{handle}`. */
export function profilePath(handle: string): string {
  return `${PROFILE_PUBLIC_ORIGIN}/${handle}`;
}
