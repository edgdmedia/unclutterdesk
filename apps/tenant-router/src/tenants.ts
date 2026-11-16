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
  /** §6.2: the current slug when the requested one is an old slug (301 redirect). */
  redirectTo?: string;
  /**
   * §6.16: set when `/` shows the owner's profile page (a solo practice whose
   * owner has published, and hasn't chosen the practice page).
   */
  profileHome?: ProfileHome;
}

export interface ProfileHome {
  /** The owner's profile handle. */
  handle: string;
  /** The practice, so the page shows its reviews and is cached per practice. */
  practiceSlug: string;
}

// The same shapes the API enforces (§6.2 handles, practice slugs): anything
// else is ignored, and the practice page is served.
const HANDLE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

// A slug is a DNS label: lowercase letters, digits and hyphens, never a dot,
// so a bad value can never rewrite the host we redirect to.
const REDIRECT_SLUG = /^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/;

/** The lookup from the API's answer (fresh or cached): only fields that pass their checks. */
function lookupOf(body: Record<string, unknown>): TenantLookup {
  const { redirectTo } = body;
  const profileHome = profileHomeOf(body);
  return {
    exists: body.exists === true,
    active: Boolean(body.active),
    ...(typeof redirectTo === 'string' && REDIRECT_SLUG.test(redirectTo) ? { redirectTo } : {}),
    ...(profileHome ? { profileHome } : {}),
  };
}

function profileHomeOf(body: Record<string, unknown>): ProfileHome | undefined {
  const { homePage, profileHandle, practiceSlug } = body;
  if (homePage !== 'PROFILE' || typeof profileHandle !== 'string' || typeof practiceSlug !== 'string') return undefined;
  if (!HANDLE.test(profileHandle) || !SLUG.test(practiceSlug)) return undefined;
  return { handle: profileHandle, practiceSlug };
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
      // Read through the same checks as a fresh answer, so nothing is lost or
      // trusted unchecked. Only checked answers are cached, but a malformed
      // entry is skipped rather than allowed to 404 a practice.
      const body = (await cached.json()) as Record<string, unknown> | null;
      if (body && typeof body.exists === 'boolean') return lookupOf(body);
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

  const result = lookupOf(body as Record<string, unknown>);

  try {
    // The API sets Cache-Control (60s for a hit, 30s for a miss), so the edge
    // cache honours a short negative TTL and a new practice goes live quickly.
    await cache.put(cacheKey, response.clone());
  } catch {
    // Caching is an optimisation; failing to cache is not an error.
  }

  return result;
}
