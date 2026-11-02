import type { APIRoute } from 'astro';
import { PROFILE_THEMES } from '@unclutterdesk/ui/src/brand/profileThemes';

// The five themes (spec §6.5) as classes, from the same tokens as the editor's
// preview. A file, not inline styles, because the CSP allows only 'self' styles.
export const prerender = true;

export const GET: APIRoute = () => {
  const css = PROFILE_THEMES.map((t) => {
    const c = t.colors;
    return `.theme-${t.key}{--bg:${c.background};--surface:${c.surface};--text:${c.text};--muted:${c.mutedText};--accent:${c.accent};--accent-text:${c.accentText};--border:${c.border}}
.theme-${t.key} .photo{border-radius:${t.photo === 'circle' ? '50%' : t.photo === 'arch' ? '999px 999px 18px 18px' : '22px'}}
.theme-${t.key} .hero{${t.header === 'centred' ? 'text-align:center;align-items:center' : t.header === 'split' ? 'flex-direction:row;align-items:center;gap:28px' : ''}}`;
  }).join('\n');
  return new Response(css, { headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
};
