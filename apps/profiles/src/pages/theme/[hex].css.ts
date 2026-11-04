import type { APIRoute } from 'astro';
import { normaliseHex } from '@unclutterdesk/ui/src/brand/brandTokens';
import { profileTheme } from '@unclutterdesk/ui/src/brand/profileThemes';

/*
 * A custom brand colour (design system; Starter and up) as a stylesheet:
 * Calm with the accent made readable by brandTokens(). A file, because the
 * CSP allows only 'self' styles. The address is the colour, so the response
 * never changes and is cached for a year.
 */
export const prerender = false;

export const GET: APIRoute = ({ params }) => {
  const hex = normaliseHex(`#${params.hex ?? ''}`);
  if (!hex || params.hex !== hex.slice(1)) return new Response('Not found', { status: 404 });
  const c = profileTheme('custom', hex).colors;
  const css = `.theme-custom{--bg:${c.background};--surface:${c.surface};--text:${c.text};--muted:${c.mutedText};--accent:${c.accent};--accent-text:${c.accentText};--soft:${c.soft};--border:${c.border}}`;
  return new Response(css, { headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable' } });
};
