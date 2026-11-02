import type { APIRoute } from 'astro';
import { config } from '../lib/env';

export const GET: APIRoute = () =>
  new Response(['User-agent: *', 'Allow: /', '', `Sitemap: ${config().publicOrigin}/sitemap.xml`, ''].join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
