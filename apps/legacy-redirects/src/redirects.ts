/**
 * §4.1b "Redirects after the move": where an old address goes. Pure, so the
 * rules are tested directly. Null means "not ours to redirect".
 */
export interface RedirectConfig {
  /** The old practice root (the zone this Worker runs on). */
  OLD_ROOT: string;
  /** Practices now live at {slug}.<NEW_PRACTICE_ROOT>. */
  NEW_PRACTICE_ROOT: string;
  /** The app, now at the bare .app domain. */
  APP_URL: string;
  /** Public profiles. */
  PROFILES_URL: string;
  /** The marketing site, which hasn't moved yet: www still goes there. */
  MARKETING_URL: string;
}

// A practice slug is one DNS label (tenant.slug rules).
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
// Hosts that are not practices and must never be sent to one. `api` keeps its
// own route (Worker = None) and is listed here in case that route is missing.
const NEVER = new Set(['api', 'mail', 'cdn', 'assets', 'static', 'status']);

const trim = (v: string) => v.replace(/\/+$/, '');

export function redirectTarget(url: URL, config: RedirectConfig): string | null {
  const host = url.hostname.toLowerCase();
  const root = config.OLD_ROOT.toLowerCase();
  if (!host.endsWith(`.${root}`)) return null;
  const label = host.slice(0, -(root.length + 1));
  if (!LABEL.test(label) || NEVER.has(label)) return null;

  const rest = `${url.pathname}${url.search}`;
  switch (label) {
    case 'app':
      return `${trim(config.APP_URL)}${rest}`;
    case 'admin':
      // admin.<root> only ever sent / to /admin on the app.
      return `${trim(config.APP_URL)}${url.pathname === '/' ? '/admin' : url.pathname}${url.search}`;
    case 'profiles':
      return `${trim(config.PROFILES_URL)}${rest}`;
    case 'www':
      return `${trim(config.MARKETING_URL)}${rest}`;
    default:
      return `https://${label}.${config.NEW_PRACTICE_ROOT.toLowerCase()}${rest}`;
  }
}
