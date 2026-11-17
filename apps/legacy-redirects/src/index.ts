/**
 * Legacy redirects (spec §4.1b): after the move to the .app domain, this Worker
 * takes the old `*.<OLD_ROOT>/*` route in the old account and sends every
 * practice, app and profile address to its new one, permanently. It reads
 * nothing and stores nothing; it never proxies.
 *
 * Kept for at least 12 months after the move.
 */
import { redirectTarget, type RedirectConfig } from './redirects';

export type Env = RedirectConfig;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const target = redirectTarget(new URL(request.url), env);
    if (!target) {
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
    }
    // 301 for page views; 308 keeps the method and body of anything else.
    const status = request.method === 'GET' || request.method === 'HEAD' ? 301 : 308;
    return new Response(null, { status, headers: { location: target } });
  },
};
