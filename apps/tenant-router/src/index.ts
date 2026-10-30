/**
 * Tenant router.
 *
 * Cloudflare Pages cannot serve a wildcard custom domain ("It is currently not
 * possible to add a custom domain with a wildcard" — Pages known issues), and it
 * matches the Host header against explicitly registered domains. That leaves the
 * per-tenant booking surfaces at https://<slug>.unclutterdesk.com unreachable.
 *
 * This Worker sits on `*.unclutterdesk.com/*` and serves the app bundle for any
 * host, with no per-tenant registration and no ceiling on tenant count. It works
 * because apps/app resolves its tenant client-side from window.location.hostname,
 * so every tenant host serves byte-identical assets.
 *
 * See docs/CLOUDFLARE_SETUP.md §1.
 */
import { decide, isCustomDomainHost, originRequest, type RouterConfig } from './router';
import { apiNotFound, apiRequest, clientResponse, isAllowedClientRoute, isApiPath, stripApiPrefix } from './api-proxy';
import { lookupTenant } from './tenants';
import { practiceNotFoundResponse } from './not-found';

export interface Env {
  /** Pages project hostname serving the app bundle. */
  ORIGIN_HOST: string;
  /** Zone apex. */
  APEX_HOST: string;
  /** API base used to check whether a practice address exists, and the /api proxy's target. */
  API_BASE: string;
  /**
   * Shared with the API (a Worker secret, never a var). With it the API trusts
   * the proxy's practice and client-IP headers; without it the proxy still
   * forwards, but the API treats requests as ordinary direct ones.
   */
  ROUTER_PROXY_SECRET?: string;
  /** Only for the local end-to-end test: "http:" to reach a local app server. */
  ORIGIN_PROTOCOL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const config: RouterConfig = {
      apexHost: env.APEX_HOST,
      originHost: env.ORIGIN_HOST,
      originProtocol: env.ORIGIN_PROTOCOL === 'http:' ? 'http:' : 'https:',
    };

    const url = new URL(request.url);

    // /api is reserved on every host this Worker serves: it never reaches the
    // app. Only a practice's custom domain proxies it (spec §6.16); practice
    // subdomains keep calling the API origin directly, so they get a 404.
    if (isApiPath(url.pathname)) {
      return proxyClientApi(request, url, env);
    }

    const decision = decide(url.hostname, config);

    switch (decision.kind) {
      case 'redirect':
        return Response.redirect(decision.to, 301);

      case 'misrouted':
        // Deliberately not falling back to the SPA: answering an API host with
        // HTML produces confusing downstream failures. See the Cloudflare route
        // exclusion in docs/CLOUDFLARE_SETUP.md §2 step 1.
        return new Response(
          `No application is configured for ${decision.host}.`,
          { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } },
        );

      case 'serve': {
        // Only booking surfaces get the existence check: the app shell is not a
        // practice address, so there is nothing to look up.
        if (decision.checkTenant) {
          const tenant = await lookupTenant(url.hostname, env.API_BASE, caches.default);
          // `exists: false` is the only outcome that 404s. A deactivated
          // practice is still served, so the app can show its inactive-practice
          // page to clients who already have sessions booked.
          if (!tenant.exists) {
            return practiceNotFoundResponse(url.hostname);
          }
        }

        // redirect: 'manual' so the origin's own redirects reach the browser
        // untouched rather than being followed against the origin host.
        const response = await fetch(originRequest(request, config), {
          redirect: 'manual',
        });

        if (decision.indexable) {
          // Response headers (including the _headers security policy) pass
          // through as-is; the body is streamed, not buffered.
          return response;
        }

        // Headers are immutable on a fetch response, so clone to add the tag.
        // Streams through: the body is passed by reference, not read here.
        const headers = new Headers(response.headers);
        headers.set('X-Robots-Tag', 'noindex, nofollow');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    }
  },
};

async function proxyClientApi(request: Request, url: URL, env: Env): Promise<Response> {
  if (!isCustomDomainHost(url.hostname, env.APEX_HOST)) return apiNotFound();
  if (!isAllowedClientRoute(request.method, stripApiPrefix(url.pathname))) return apiNotFound();
  // Only an ACTIVE custom domain exists to the API's lookup; the API checks
  // again on every request, so a lookup that fails open costs nothing.
  const tenant = await lookupTenant(url.hostname, env.API_BASE, caches.default);
  if (!tenant.exists) return apiNotFound();

  const response = await fetch(
    apiRequest(request, { apiBase: env.API_BASE, practiceHost: url.hostname.toLowerCase(), secret: env.ROUTER_PROXY_SECRET }),
  );
  return clientResponse(response);
}
