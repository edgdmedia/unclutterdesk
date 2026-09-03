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
import { decide, originRequest, type RouterConfig } from './router';

export interface Env {
  /** Pages project hostname serving the app bundle. */
  ORIGIN_HOST: string;
  /** Zone apex. */
  APEX_HOST: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const config: RouterConfig = {
      apexHost: env.APEX_HOST,
      originHost: env.ORIGIN_HOST,
    };

    const url = new URL(request.url);
    const decision = decide(url.hostname, config);

    switch (decision.kind) {
      case 'redirect':
        return Response.redirect(decision.to, 301);

      case 'misrouted':
        // Deliberately not falling back to the SPA: answering an API host with
        // HTML produces confusing downstream failures. See the Cloudflare route
        // exclusions in docs/CLOUDFLARE_SETUP.md §1.
        return new Response(
          `No application is configured for ${decision.host}.`,
          { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } },
        );

      case 'serve': {
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
