import { defineMiddleware } from 'astro:middleware';
import { config } from './lib/env';
import { securityHeaders } from './lib/security';
import { PRACTICE_SLUG_HEADER, practiceSlug } from './lib/practice-host';

/**
 * Every response (spec §4.3): the security headers, and never a cookie. The
 * renderer reads no cookies or Authorization. Pages are cached by Workers
 * Caching (wrangler.jsonc "cache"), from the Cache-Control and Cache-Tag each
 * page sets; the cache key is the URL, never the visitor.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const headers = new Headers(response.headers);
  // Only the PracticeHost entrypoint sets this header (worker.ts, §6.16).
  const practiceHost = practiceSlug(context.request.headers.get(PRACTICE_SLUG_HEADER)) !== null;
  for (const [name, value] of Object.entries(securityHeaders(config(), { practiceHost }))) headers.set(name, value);
  headers.delete('set-cookie');
  headers.delete('vary');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
});
