/**
 * The app Worker's only code. wrangler.jsonc sends just the Desk-home paths
 * here (assets.run_worker_first); everything else is served from the built
 * files without running this.
 *
 * On the app's own host those paths go to the profiles Worker's DeskSite
 * entrypoint, which renders the Desk's home and pricing. On any other host
 * (the tenant router fetches practice pages through workers.dev) they stay
 * the app: a practice's `/` is its booking page.
 */
interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ASSETS: Fetcher;
  DESK_SITE: Fetcher;
  /** The app's public host, e.g. the apex of the tenant root domain. */
  APP_HOST: string;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const host = new URL(request.url).hostname;
    return host === env.APP_HOST ? env.DESK_SITE.fetch(request) : env.ASSETS.fetch(request);
  },
};
