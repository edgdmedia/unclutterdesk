import type { ProfilesConfig } from './config';

/**
 * Response headers for every page (spec §4.3 #1 and #3). The site never sets
 * cookies, so nothing here varies by visitor.
 */
export function securityHeaders(config: ProfilesConfig): Record<string, string> {
  const img = ["'self'", 'data:', config.mediaOrigin].filter(Boolean).join(' ');
  const csp = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    `img-src ${img}`,
    "font-src 'self'",
    "manifest-src 'self'",
    `connect-src ${config.apiOrigin}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
    // The report form posts to this site (§6.15); nothing else posts.
    `form-action 'self' ${config.apiOrigin}`,
  ].join('; ');
  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
  };
}

/** Published pages: cached at the edge for 5 minutes, served stale while revalidating; never per visitor. */
export const PAGE_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
/** 404 / 410: cached briefly, so a just-published profile appears quickly. */
export const MISS_CACHE = 'public, max-age=30, s-maxage=60';

/** An https link safe to put in an href, or null. Therapist links are never anything else (§4.3 #4). */
export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * JSON for a <script type="application/ld+json"> block, with every character
 * that could close the element or start markup escaped, so therapist text
 * inside it can never break out (§6.11 "serialised safely").
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
