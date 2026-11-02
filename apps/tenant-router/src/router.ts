// Routing decisions, kept free of the fetch call so they can be tested directly.

export interface RouterConfig {
  /** The zone apex (APEX_HOST in wrangler.jsonc). */
  apexHost: string;
  /** Where the app bundle actually lives, e.g. "app-unclutterdesk.pages.dev". */
  originHost: string;
  /** "https:" in production; "http:" only for the local end-to-end test. */
  originProtocol?: 'https:' | 'http:';
}

/**
 * Normalises a hostname for practice lookups: lowercases and removes one trailing dot.
 * This ensures consistent matching across the router and API when headers come from
 * different sources (e.g., Cloudflare for SaaS vs. the API's own checks).
 */
export function normalizeHost(hostname: string): string {
  const lower = hostname.toLowerCase();
  return lower.endsWith('.') ? lower.slice(0, -1) : lower;
}

/**
 * A host outside our zone: a practice custom domain arriving through
 * Cloudflare for SaaS. The client API proxy runs only on these (spec §6.16).
 */
export function isCustomDomainHost(hostname: string, apexHost: string): boolean {
  const host = hostname.toLowerCase();
  return host !== apexHost && !host.endsWith(`.${apexHost}`);
}

/**
 * Hosts that serve the application shell rather than a public booking surface.
 * They are still served, but must not be indexed: the signed-in app has no
 * public content, and letting it into search results competes with the
 * practice booking pages that are meant to rank.
 */
const NON_PUBLIC_LABELS = new Set(['app', 'admin']);

export type Decision =
  /**
   * Serve the app bundle for this host. `indexable` is false for the
   * application shell, which is returned with X-Robots-Tag: noindex.
   * `checkTenant` marks a host that represents a practice address, and so
   * should 404 when no such practice exists.
   */
  | { kind: 'serve'; indexable: boolean; checkTenant: boolean }
  /** Send www to the marketing site at the apex. */
  | { kind: 'redirect'; to: string }
  /**
   * A subdomain that belongs to a different origin and must never be answered
   * with the SPA. Reaching this means a more specific Worker route is missing
   * in Cloudflare — failing loudly beats silently serving the wrong app.
   */
  | { kind: 'misrouted'; host: string };

/**
 * Subdomains that are not tenant booking surfaces and are not the app.
 * `api` has its own origin (nginx). `app` is deliberately absent: it serves
 * byte-identical assets to every tenant host, so proxying it here is correct.
 */
const FOREIGN_ORIGIN_LABELS = new Set(['api']);

export function decide(hostname: string, config: RouterConfig): Decision {
  const host = hostname.toLowerCase();
  const { apexHost } = config;

  // The route pattern `*.<apex>/*` does not match the bare apex, but
  // handle it anyway so the Worker is correct if the route is ever widened.
  if (host === apexHost) return { kind: 'redirect', to: `https://${apexHost}/` };

  if (isCustomDomainHost(host, apexHost)) {
    // Not our zone at all. A custom domain arriving via Cloudflare for SaaS is
    // a real tenant surface, so serve it — and it should be indexable. It is
    // also a practice address, so an unconfigured domain pointed at us 404s.
    return { kind: 'serve', indexable: true, checkTenant: true };
  }

  const label = host.slice(0, -(apexHost.length + 1));

  // Only single-label subdomains are tenant surfaces: "dr-smith" yes,
  // "a.b" no. A multi-label host under the apex is not something we issue.
  if (label.includes('.')) return { kind: 'misrouted', host };

  if (label === 'www') return { kind: 'redirect', to: `https://${apexHost}/` };
  if (FOREIGN_ORIGIN_LABELS.has(label)) return { kind: 'misrouted', host };

  const isAppShell = NON_PUBLIC_LABELS.has(label);
  return { kind: 'serve', indexable: !isAppShell, checkTenant: !isAppShell };
}

/**
 * Rewrite an incoming request onto the Pages origin, preserving path, query,
 * method, body and headers. Only the host changes — the SPA resolves its tenant
 * from window.location in the browser, so the origin can serve one bundle for
 * every host.
 *
 * Session credentials are stripped: the app origin serves a static SPA and
 * never sees authenticated requests; sending them would leak cookies across
 * hosts and confuse the origin's own caching.
 */
export function originRequest(request: Request, config: RouterConfig): Request {
  const url = new URL(request.url);
  url.protocol = config.originProtocol ?? 'https:';
  // If originHost includes a port (e.g. local e2e setup), use it; otherwise clear any visitor port.
  // Cloudflare proxies 8443, 2053 and other ports, so we must not forward the visitor's port.
  if (config.originHost.includes(':')) {
    url.href = `${url.protocol}//${config.originHost}${url.pathname}${url.search}`;
  } else {
    url.hostname = config.originHost;
    url.port = '';
  }

  // The Host header is derived from the URL and cannot be set manually in
  // Workers; passing the original host through would make Pages reject the
  // request as an unregistered custom domain.
  const headers = new Headers(request.headers);
  headers.delete('cookie');
  headers.delete('authorization');
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  return new Request(url.toString(), {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: request.redirect,
    ...(hasBody ? { duplex: 'half' } : {}),
  } as RequestInit);
}
