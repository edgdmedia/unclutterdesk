/**
 * Existence lookup for the host being served.
 *
 * The guiding rule is **fail open**. A wrong 404 takes a real practice's
 * booking page off the internet, while a wrong 200 merely shows the app's own
 * not-found screen. So anything uncertain — the API being down, slow, or
 * returning something unexpected — serves the app rather than a 404.
 */

export interface TenantLookup {
  /** false only when the API positively said the practice does not exist. */
  exists: boolean;
  /** A practice that exists but is deactivated is still served. */
  active: boolean;
}

const SERVE_ANYWAY: TenantLookup = { exists: true, active: true };

// A slow origin must not hold up the page.
const LOOKUP_TIMEOUT_MS = 1200;

export async function lookupTenant(
  host: string,
  apiBase: string,
  cache: Cache,
): Promise<TenantLookup> {
  // Synthetic key: the probe is cached per host, independent of the real request
  // path, so every page of a practice site shares one lookup.
  const cacheKey = new Request(`https://tenant-lookup.internal/${encodeURIComponent(host)}`);

  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      return (await cached.json()) as TenantLookup;
    }
  } catch {
    // A cache read failure is not a reason to block the request.
  }

  let response: Response;
  try {
    response = await fetch(
      `${apiBase}/v1/tenant/public/exists/${encodeURIComponent(host)}`,
      { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) },
    );
  } catch {
    // Network error or timeout — serve the app.
    return SERVE_ANYWAY;
  }

  if (!response.ok) {
    // Includes 5xx and anything unexpected. Notably the API returns 200 with
    // {exists:false} for a missing practice, so a non-OK status here means the
    // probe itself failed, not that the practice is absent.
    return SERVE_ANYWAY;
  }

  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return SERVE_ANYWAY;
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as TenantLookup).exists !== 'boolean'
  ) {
    return SERVE_ANYWAY;
  }

  const result: TenantLookup = {
    exists: (body as TenantLookup).exists,
    active: Boolean((body as TenantLookup).active),
  };

  try {
    // The API sets Cache-Control (300s for a hit, 30s for a miss), so the edge
    // cache honours a short negative TTL and a new practice goes live quickly.
    await cache.put(cacheKey, response.clone());
  } catch {
    // Caching is an optimisation; failing to cache is not an error.
  }

  return result;
}
