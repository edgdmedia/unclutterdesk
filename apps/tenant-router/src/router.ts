// Routing decisions, kept free of the fetch call so they can be tested directly.

export interface RouterConfig {
  /** The zone apex, e.g. "unclutterdesk.com". */
  apexHost: string;
  /** Where the app bundle actually lives, e.g. "app-unclutterdesk.pages.dev". */
  originHost: string;
}

export type Decision =
  /** Serve the app bundle for this host (a tenant booking surface, or the app itself). */
  | { kind: 'serve' }
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

  // The route pattern `*.unclutterdesk.com/*` does not match the bare apex, but
  // handle it anyway so the Worker is correct if the route is ever widened.
  if (host === apexHost) return { kind: 'redirect', to: `https://${apexHost}/` };

  if (!host.endsWith(`.${apexHost}`)) {
    // Not our zone at all. A custom domain arriving via Cloudflare for SaaS is
    // a real tenant surface, so serve it.
    return { kind: 'serve' };
  }

  const label = host.slice(0, -(apexHost.length + 1));

  // Only single-label subdomains are tenant surfaces: "dr-smith" yes,
  // "a.b" no. A multi-label host under the apex is not something we issue.
  if (label.includes('.')) return { kind: 'misrouted', host };

  if (label === 'www') return { kind: 'redirect', to: `https://${apexHost}/` };
  if (FOREIGN_ORIGIN_LABELS.has(label)) return { kind: 'misrouted', host };

  return { kind: 'serve' };
}

/**
 * Rewrite an incoming request onto the Pages origin, preserving path, query,
 * method, body and headers. Only the host changes — the SPA resolves its tenant
 * from window.location in the browser, so the origin can serve one bundle for
 * every host.
 */
export function originRequest(request: Request, config: RouterConfig): Request {
  const url = new URL(request.url);
  url.protocol = 'https:';
  url.hostname = config.originHost;
  url.port = '';

  // The Host header is derived from the URL and cannot be set manually in
  // Workers; passing the original host through would make Pages reject the
  // request as an unregistered custom domain.
  return new Request(url.toString(), request);
}
