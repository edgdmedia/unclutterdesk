import { PrismaService } from './prisma/prisma.service';

// Exact-match origins that are always allowed in every environment.
const ROOT_ORIGINS = ['https://unclutterdesk.com', 'https://www.unclutterdesk.com'];

// Tenant booking surfaces: https://<slug>.unclutterdesk.com — single label only, so
// this cannot be satisfied by an attacker-controlled host such as
// "https://evil.com/x.unclutterdesk.com" or "https://unclutterdesk.com.evil.com".
const TENANT_SUBDOMAIN = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.unclutterdesk\.com$/;

// Dev-only. Never consulted when NODE_ENV=production.
const LOCAL_ORIGIN = /^https?:\/\/(?:[a-z0-9-]+\.)*localhost(?::\d+)?$/;
const PAGES_PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.pages\.dev$/;

// Verified tenant custom domains live in the database, so they are cached rather
// than queried on every preflight.
const CUSTOM_DOMAIN_TTL_MS = 60_000;

export function createCorsOriginHandler(
  prisma: PrismaService,
  options: { isProduction: boolean; configuredOrigins: string[] },
) {
  const { isProduction, configuredOrigins } = options;

  let cache = new Set<string>();
  let cachedAt = 0;
  let inFlight: Promise<Set<string>> | null = null;

  async function loadCustomDomains(): Promise<Set<string>> {
    const tenants = await prisma.tenant.findMany({
      where: { customDomainStatus: 'ACTIVE', isActive: true, customDomain: { not: null } },
      select: { customDomain: true },
    });
    return new Set(
      tenants
        .map((tenant) => tenant.customDomain?.trim().toLowerCase())
        .filter((domain): domain is string => Boolean(domain))
        .map((domain) => `https://${domain}`),
    );
  }

  function customDomains(): Promise<Set<string>> {
    if (Date.now() - cachedAt < CUSTOM_DOMAIN_TTL_MS) return Promise.resolve(cache);
    if (inFlight) return inFlight;

    inFlight = loadCustomDomains()
      .then((domains) => {
        cache = domains;
        cachedAt = Date.now();
        return domains;
      })
      .catch(() => cache) // Serve the stale set rather than locking every tenant out.
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  }

  return function corsOrigin(
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ): void {
    // Same-origin and non-browser clients (curl, webhooks, health checks) send no Origin.
    if (!origin) return callback(null, true);

    const candidate = origin.toLowerCase();

    if (
      configuredOrigins.includes(origin) ||
      ROOT_ORIGINS.includes(candidate) ||
      TENANT_SUBDOMAIN.test(candidate)
    ) {
      return callback(null, true);
    }

    if (!isProduction && (LOCAL_ORIGIN.test(candidate) || PAGES_PREVIEW_ORIGIN.test(candidate))) {
      return callback(null, true);
    }

    // A rejected origin is not a server error: answer without the
    // Access-Control-Allow-Origin header and let the browser block it.
    customDomains()
      .then((domains) => callback(null, domains.has(candidate)))
      .catch(() => callback(null, false));
  };
}
