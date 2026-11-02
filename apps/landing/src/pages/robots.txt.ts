import type { APIRoute } from 'astro';
import { MARKETING_ORIGIN } from '../config/domains';

// Built from the domain config (spec §4.1a) so the sitemap address follows
// the marketing site when it moves. The app and the per-practice booking
// sites are served by a different project and are not covered here.
export const GET: APIRoute = () =>
  new Response(
    ['# Unclutter Desk — marketing site', '', 'User-agent: *', 'Allow: /', '', `Sitemap: ${MARKETING_ORIGIN}/sitemap-index.xml`, ''].join('\n'),
    { headers: { 'content-type': 'text/plain; charset=utf-8' } },
  );
