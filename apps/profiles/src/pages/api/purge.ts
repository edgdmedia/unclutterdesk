import type { APIRoute } from 'astro';
import { cache, env } from 'cloudflare:workers';
import { purgeTags, secretMatches } from '../../lib/purge';

/**
 * POST /api/purge (spec §6.12): the API's profile.purge job calls this when a
 * published profile changes. Workers Caching entries can only be purged from
 * inside the Worker that owns them, so the purge happens here. Guarded by
 * PROFILES_PURGE_SECRET; never cached (POST).
 */
export const POST: APIRoute = async ({ request }) => {
  const secret = (env as unknown as { PROFILES_PURGE_SECRET?: string }).PROFILES_PURGE_SECRET;
  if (!secretMatches(request.headers.get('x-purge-secret'), secret)) return new Response(null, { status: 404 });
  const tags = purgeTags(await request.json().catch(() => null));
  if (!tags) return Response.json({ error: 'tags' }, { status: 400 });
  // A failed purge answers 502 with the reason, so the API's job records it
  // and retries (§6.12: never swallowed).
  try {
    const result = await cache.purge({ tags });
    return Response.json(result, { status: result.success ? 200 : 502 });
  } catch (err) {
    return Response.json({ success: false, errors: [{ message: (err as Error).message }] }, { status: 502 });
  }
};
