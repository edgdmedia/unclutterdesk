import type { APIRoute } from 'astro';
import { PROFILE_THEMES } from '@unclutterdesk/ui/src/brand/profileThemes';
import { therapystsCssVars } from '@unclutterdesk/ui/src/brand/therapysts';

// The five palettes (spec §6.5) as classes, from the same tokens as the editor's
// preview. A file, not inline styles, because the CSP allows only 'self' styles.
export const prerender = true;

export const GET: APIRoute = () => {
  const css = PROFILE_THEMES.map((t) => {
    const c = t.colors;
    return `.theme-${t.key}{--bg:${c.background};--surface:${c.surface};--text:${c.text};--muted:${c.mutedText};--accent:${c.accent};--accent-text:${c.accentText};--soft:${c.soft};--border:${c.border}}`;
  }).join('\n');
  // The Therapysts design system's own tokens (--ds-*): the site's pages and the
  // Therapysts top bar and footer use these; a profile's palette never changes them.
  const brand = `:root{${therapystsCssVars('light')}}`;
  return new Response(`${brand}\n${css}`, { headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
};
