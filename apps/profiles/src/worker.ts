/**
 * The profiles Worker's entrypoints.
 *
 * - default: the profile site, for everyone. A visitor can never switch on the
 *   practice-host page: any practice header they send is removed.
 * - PracticeHost (§6.16): reachable only through a service binding, which the
 *   tenant router has. It serves a solo practice's `/` as the owner's profile
 *   page, with the practice's reviews and links that work from the practice's
 *   host. Workers Caching keys by entrypoint, path and query, so these pages
 *   are cached apart from the profile site's, one copy per practice.
 */
import { handle } from '@astrojs/cloudflare/handler';
import { WorkerEntrypoint } from 'cloudflare:workers';
import { config } from './lib/env';
import { forPracticeHost, practiceHostRequest, publicRequest } from './lib/practice-host';

export default {
  fetch(request, env, ctx) {
    return handle(publicRequest(request), env, ctx);
  },
} satisfies ExportedHandler<Env>;

export class PracticeHost extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    const practiceRequest = practiceHostRequest(request);
    if (!practiceRequest) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    const response = await handle(practiceRequest, this.env, this.ctx);
    return forPracticeHost(response, config());
  }

  /**
   * A purge only reaches the cache of the entrypoint that calls it, so
   * POST /api/purge (on the default entrypoint) also calls this, through
   * ctx.exports, to clear this entrypoint's copies of the same pages.
   */
  async purge(tags: string[]): Promise<{ success: boolean }> {
    // Workers Caching is on for this Worker (wrangler.jsonc "cache"), so ctx.cache is always there when deployed.
    if (!this.ctx.cache) throw new Error('Workers Caching is not enabled for PracticeHost');
    const result = await this.ctx.cache.purge({ tags });
    return { success: result.success };
  }
}
