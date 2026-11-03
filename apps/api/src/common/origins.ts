/**
 * Where this platform legitimately lives on the web.
 *
 * One definition, shared by CORS and by anywhere a URL is handed to a third
 * party to redirect a person back to us. Two notions of "our origins" drifting
 * apart is how a redirect ends up trusting a host the browser would not.
 *
 * This is also the API's one domain config (spec §4.1a): every production
 * address is a setting read here, with today's address as its default, so the
 * move to new domains (§4.1b) is a change of settings, not of code. No other
 * API file may spell out a production domain (domain-literals.spec.ts).
 */

const trimSlash = (value: string) => value.replace(/\/+$/, '');
const setting = (name: string) => process.env[name]?.trim() || undefined;

/** Practice subdomains are `{slug}.<root>`. TENANT_ROOT_DOMAIN, default unclutterdesk.com. */
export const TENANT_ROOT_DOMAIN = (setting('TENANT_ROOT_DOMAIN') ?? 'unclutterdesk.com').toLowerCase().replace(/^\.+|\.+$/g, '');

/** The marketing site. MARKETING_URL, default https://unclutterdesk.com. */
export const MARKETING_ORIGIN = trimSlash(setting('MARKETING_URL') ?? 'https://unclutterdesk.com');

/** Production defaults for the app and API. Their own settings, never derived from the root domain. */
const DEFAULT_APP_ORIGIN = 'https://app.unclutterdesk.com';
const DEFAULT_API_ORIGIN = 'https://api.unclutterdesk.com';

/**
 * Public profile pages (spec §4.1, §4.1b). PROFILE_PUBLIC_URL. Profiles went
 * straight to their target domain, so the default is the live address.
 */
export const PROFILE_PUBLIC_ORIGIN = trimSlash(setting('PROFILE_PUBLIC_URL') ?? 'https://therapysts.com');

/**
 * Where public R2 files are served (R2_PUBLIC_URL, the public bucket's custom
 * domain, e.g. media.<marketing domain>). No default: until it is set, nothing
 * is uploaded to the public bucket.
 */
export const MEDIA_ORIGIN = setting('R2_PUBLIC_URL') ? trimSlash(setting('R2_PUBLIC_URL')!) : null;

/** Platform mail goes from MAIL_FROM (or SMTP_FROM); this is the address when neither is set. */
export const FALLBACK_SENDER_ADDRESS = `no-reply@${TENANT_ROOT_DOMAIN}`;

/**
 * The domain in a calendar event's UID. Fixed for good, not a setting: a
 * subscribed calendar matches events by UID, so changing it at a domain move
 * would show every existing booking twice.
 */
export const ICAL_UID_DOMAIN = 'unclutterdesk.com';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Exact-match origins that are always allowed in every environment: the marketing site and its www. */
export const ROOT_ORIGINS = [MARKETING_ORIGIN, MARKETING_ORIGIN.replace(/^https:\/\/(?!www\.)/, 'https://www.')].filter(
  (origin, i, all) => all.indexOf(origin) === i,
);

/**
 * Tenant booking surfaces: https://<slug>.<root> — a single label only, so
 * this cannot be satisfied by an attacker-controlled host such as
 * "https://evil.com/x.<root>" or "https://<root>.evil.com".
 */
export const TENANT_SUBDOMAIN = new RegExp(
  `^https:\\/\\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.${escapeRegex(TENANT_ROOT_DOMAIN)}$`,
);

/** Dev-only. Never consulted when NODE_ENV=production. */
export const LOCAL_ORIGIN = /^https?:\/\/(?:[a-z0-9-]+\.)*localhost(?::\d+)?$/;
export const PAGES_PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.pages\.dev$/;

/** The workspace app, where staff land after a subscription payment. */
export function appOrigin(isProduction = process.env.NODE_ENV === 'production'): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return isProduction ? DEFAULT_APP_ORIGIN : 'http://localhost:5173';
}

/**
 * The public booking site for one practice — its own domain once that is
 * verified, otherwise its subdomain.
 *
 * A custom domain is only used at status ACTIVE: a PENDING one does not resolve
 * yet, so sending a paying client there would strand them on a dead host.
 */
/** The API's own public address, for links to things it serves (e.g. practice logos in emails). */
/**
 * A full address for a link that may be an in-app path ("/dashboard/sessions/8").
 * In-app paths open on the app host, where staff and clients can both sign in.
 */
export function absoluteUrl(link: string, isProduction = process.env.NODE_ENV === 'production'): string {
  return link.startsWith('/') ? `${appOrigin(isProduction)}${link}` : link;
}

export function apiOrigin(isProduction = process.env.NODE_ENV === 'production'): string {
  const configured = process.env.API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return isProduction ? DEFAULT_API_ORIGIN : 'http://localhost:3099';
}

export function tenantWebOrigin(
  tenant: { slug: string; customDomain?: string | null; customDomainStatus?: string | null },
  isProduction = process.env.NODE_ENV === 'production',
): string {
  if (!isProduction) return appOrigin(isProduction);

  const domain = tenant.customDomain?.trim().toLowerCase();
  if (domain && tenant.customDomainStatus === 'ACTIVE') return `https://${domain}`;
  return `https://${tenant.slug}.${TENANT_ROOT_DOMAIN}`;
}

/**
 * The public-profile site (spec §4.3): it shows text therapists write, so it
 * is never trusted the way the platform is. No credentialed CORS, no CSRF
 * pass with a session, and never a redirect target. It may sit under the
 * tenant root today (profiles.<root>), so this check comes first.
 */
export function isProfilesOrigin(candidate: string): boolean {
  return candidate.toLowerCase().replace(/\/+$/, '') === PROFILE_PUBLIC_ORIGIN.toLowerCase();
}

export function isPlatformOrigin(
  candidate: string,
  isProduction = process.env.NODE_ENV === 'production',
): boolean {
  const origin = candidate.toLowerCase();
  if (isProfilesOrigin(origin)) return false;
  if (ROOT_ORIGINS.includes(origin) || TENANT_SUBDOMAIN.test(origin)) return true;
  if (!isProduction && (LOCAL_ORIGIN.test(origin) || PAGES_PREVIEW_ORIGIN.test(origin))) return true;
  return false;
}

/**
 * Whether a URL is somewhere we are willing to send a person back to after a
 * payment.
 *
 * Paystack redirects the paying client to whatever `callback_url` it was given,
 * so an unchecked value is a phishing page wearing our checkout as its
 * approach: the client pays us, then lands somewhere else entirely, still
 * believing they are with their therapist's practice.
 *
 * Both call sites now build this URL themselves rather than accepting one, so
 * nothing caller-supplied reaches Paystack. This stays as the check those
 * built URLs are held to, and as the rule to apply if a caller-supplied value
 * is ever reintroduced.
 */
export function isAllowedRedirectTarget(
  candidate: string,
  options: { isProduction?: boolean; customDomains?: Iterable<string> } = {},
): boolean {
  const isProduction = options.isProduction ?? process.env.NODE_ENV === 'production';

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    // Not a URL at all — including protocol-relative "//evil.com", which a
    // browser resolves against our own scheme and follows happily.
    return false;
  }

  // Blocks javascript:, data:, and every other scheme that is not a web page.
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && !isProduction)) return false;

  // Credentials in a URL ("https://app.<root>@evil.com") are how a
  // host is disguised as a path to a reader skimming the address bar.
  if (url.username || url.password) return false;

  if (isPlatformOrigin(url.origin, isProduction)) return true;

  if (options.customDomains) {
    const allowed = new Set(
      [...options.customDomains].map((d) => `https://${d.trim().toLowerCase()}`),
    );
    return allowed.has(url.origin.toLowerCase());
  }

  return false;
}

/**
 * The hostname practices point their custom domain's CNAME at. One setting,
 * CUSTOM_DOMAIN_TARGET; CLOUDFLARE_SAAS_CNAME_TARGET is still read when it is
 * unset, so an existing .env keeps working. Unset means Cloudflare for SaaS is
 * not configured, so no custom domain can be served and none may be marked active.
 */
export function customDomainTarget(): string | null {
  const target = (setting('CUSTOM_DOMAIN_TARGET') ?? setting('CLOUDFLARE_SAAS_CNAME_TARGET'))?.toLowerCase().replace(/\.$/, '');
  return target || null;
}
