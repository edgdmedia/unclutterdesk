import type { APIRoute } from 'astro';
import { config } from '../lib/env';
import { sitemapEntries } from '../lib/profiles';
import { SITEMAP_TAG } from '../lib/purge';

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async () => {
  const cfg = config();
  const entries = await sitemapEntries(cfg);
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.map((e) => `  <url><loc>${xml(`${cfg.publicOrigin}/${e.handle}`)}</loc><lastmod>${xml(e.updatedAt)}</lastmod></url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=600', 'cache-tag': SITEMAP_TAG } });
};
