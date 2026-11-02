import { defineMiddleware } from 'astro:middleware';
import { config } from './lib/env';
import { securityHeaders } from './lib/security';

/**
 * Every response (spec §4.3): the security headers, and never a cookie. The
 * renderer reads no cookies or Authorization, and since nothing varies by
 * visitor, pages are cached at the edge by URL alone (cookies are not part of
 * the key), through the Workers Cache API.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { request } = context;
  const cache = typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null;
  const url = new URL(request.url);
  const cacheKey = new Request(url.origin + url.pathname, { method: 'GET' });
  const cacheable = request.method === 'GET' && !url.search && cache !== null;

  if (cacheable) {
    const hit = await cache!.match(cacheKey);
    if (hit) return hit;
  }

  const response = await next();
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders(config()))) headers.set(name, value);
  headers.delete('set-cookie');
  headers.delete('vary');
  const out = new Response(response.body, { status: response.status, statusText: response.statusText, headers });

  const cc = headers.get('cache-control') ?? '';
  if (cacheable && /s-maxage=\d+/.test(cc) && (out.status === 200 || out.status === 404 || out.status === 410)) {
    await cache!.put(cacheKey, out.clone());
  }
  return out;
});
