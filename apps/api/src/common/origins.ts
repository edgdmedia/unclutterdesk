/**
 * Where this platform legitimately lives on the web.
 *
 * One definition, shared by CORS and by anywhere a URL is handed to a third
 * party to redirect a person back to us. Two notions of "our origins" drifting
 * apart is how a redirect ends up trusting a host the browser would not.
 */

/** Exact-match origins that are always allowed in every environment. */
export const ROOT_ORIGINS = ['https://unclutterdesk.com', 'https://www.unclutterdesk.com'];

/**
 * Tenant booking surfaces: https://<slug>.unclutterdesk.com — a single label
 * only, so this cannot be satisfied by an attacker-controlled host such as
 * "https://evil.com/x.unclutterdesk.com" or "https://unclutterdesk.com.evil.com".
 */
export const TENANT_SUBDOMAIN =
  /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.unclutterdesk\.com$/;

/** Dev-only. Never consulted when NODE_ENV=production. */
export const LOCAL_ORIGIN = /^https?:\/\/(?:[a-z0-9-]+\.)*localhost(?::\d+)?$/;
export const PAGES_PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.pages\.dev$/;

export const ROOT_DOMAIN = 'unclutterdesk.com';

/** The workspace app, where staff land after a subscription payment. */
export function appOrigin(isProduction = process.env.NODE_ENV === 'production'): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return isProduction ? `https://app.${ROOT_DOMAIN}` : 'http://localhost:5173';
}

/**
 * The public booking site for one practice — its own domain once that is
 * verified, otherwise its subdomain.
 *
 * A custom domain is only used at status ACTIVE: a PENDING one does not resolve
 * yet, so sending a paying client there would strand them on a dead host.
 */
export function tenantWebOrigin(
  tenant: { slug: string; customDomain?: string | null; customDomainStatus?: string | null },
  isProduction = process.env.NODE_ENV === 'production',
): string {
  if (!isProduction) return appOrigin(isProduction);

  const domain = tenant.customDomain?.trim().toLowerCase();
  if (domain && tenant.customDomainStatus === 'ACTIVE') return `https://${domain}`;
  return `https://${tenant.slug}.${ROOT_DOMAIN}`;
}

export function isPlatformOrigin(
  candidate: string,
  isProduction = process.env.NODE_ENV === 'production',
): boolean {
  const origin = candidate.toLowerCase();
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

  // Credentials in a URL ("https://app.unclutterdesk.com@evil.com") are how a
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
