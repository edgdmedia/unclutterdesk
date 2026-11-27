/**
 * §6.16 "One page, two addresses": `/` on a solo practice's address is the
 * owner's profile page, rendered by the profiles Worker's PracticeHost
 * entrypoint and fetched over the PROFILES service binding (never over the
 * public internet). The same rules as the profile site apply: nothing from the
 * visitor's request identifies them to it, and no cookie comes back.
 *
 * Fail open, like the existence lookup: if the profiles Worker fails or
 * answers anything but 200, the router serves the practice page instead.
 */
import type { ProfileHome } from './tenants';

/**
 * Only `/`; every other path on a practice address is unchanged. A query
 * string (a shared link's `?utm_source=`) still gets the profile page; it is
 * not forwarded, so every visitor shares one cached copy.
 */
export function wantsProfileHome(request: Request, url: URL): boolean {
  return url.pathname === '/' && (request.method === 'GET' || request.method === 'HEAD');
}

// Content negotiation only. No Cookie, no Authorization, no client hints.
const FORWARDED = ['accept', 'accept-language', 'user-agent'];

/** The binding request: `/{handle}?practice={slug}`, which is also the profiles Worker's cache key. */
export function profileHomeRequest(request: Request, url: URL, home: ProfileHome): Request {
  const target = new URL(`/${home.handle}`, url.origin);
  target.searchParams.set('practice', home.practiceSlug);
  const headers = new Headers();
  for (const name of FORWARDED) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Request(target.toString(), { method: request.method, headers, redirect: 'manual' });
}

/** The page as the visitor gets it: never a Set-Cookie, and practice subdomains stay out of search. */
export function profileHomeResponse(response: Response, indexable: boolean): Response {
  const headers = new Headers(response.headers);
  headers.delete('set-cookie');
  if (!indexable) headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** The owner's profile page for `/`, or null to serve the practice page. */
export async function fetchProfileHome(profiles: Fetcher, request: Request, url: URL, home: ProfileHome, indexable: boolean): Promise<Response | null> {
  try {
    const response = await profiles.fetch(profileHomeRequest(request, url, home));
    if (response.status !== 200) {
      // Logged (Workers observability), so a broken profile home is noticed, not just quietly replaced.
      console.warn(`profile home for ${url.hostname} answered ${response.status}; serving the practice page`);
      await response.body?.cancel();
      return null;
    }
    return profileHomeResponse(response, indexable);
  } catch (err) {
    console.warn(`profile home for ${url.hostname} failed (${(err as Error).message}); serving the practice page`);
    return null;
  }
}
