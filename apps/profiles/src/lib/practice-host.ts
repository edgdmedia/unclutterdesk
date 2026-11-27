import type { ProfilesConfig } from './config';

/**
 * §6.16 "One page, two addresses": a solo practice's address shows its
 * owner's profile page at `/`. The tenant router fetches it through a service
 * binding to this Worker's `PracticeHost` entrypoint, which no visitor can
 * reach. Only that entrypoint sets the header below; the public entrypoint
 * removes any copy a visitor sends, so the practice-host page can never be
 * asked for from outside.
 */
export const PRACTICE_SLUG_HEADER = 'x-practice-slug';
/** The router names the practice in the query, so the Worker's cache keeps one copy per practice. */
export const PRACTICE_PARAM = 'practice';
/** Marks a link that must stay on the practice's own host (the Book button). Removed before the page is sent. */
export const PRACTICE_LOCAL_ATTR = 'data-practice-local';

// Practice slugs: lowercase letters, digits and inner hyphens, at most 50 (tenant.slug).
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

export function practiceSlug(value: string | null | undefined): string | null {
  return typeof value === 'string' && SLUG.test(value) ? value : null;
}

/** The public entrypoint: whatever a visitor sends, the page is never in practice-host mode. */
export function publicRequest(request: Request): Request {
  if (!request.headers.has(PRACTICE_SLUG_HEADER)) return request;
  const headers = new Headers(request.headers);
  headers.delete(PRACTICE_SLUG_HEADER);
  return new Request(request, { headers });
}

/**
 * The PracticeHost entrypoint: the router asks for `/{handle}?practice={slug}`.
 * Null when the request isn't that shape, so the entrypoint answers 404.
 */
export function practiceHostRequest(request: Request): Request | null {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  const slug = practiceSlug(url.searchParams.get(PRACTICE_PARAM));
  if (!slug || !/^\/[a-z0-9-]+$/.test(url.pathname)) return null;
  const headers = new Headers({ accept: 'text/html' });
  for (const name of ['accept-language', 'user-agent']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set(PRACTICE_SLUG_HEADER, slug);
  return new Request(url.toString(), { method: request.method, headers });
}

/**
 * A root-relative URL made absolute on the profiles origin, since the page is
 * served on the practice's host (§6.16 "Links must work from both
 * addresses"). Anything else (absolute, protocol-relative, fragment, mailto)
 * is returned unchanged.
 */
export function onProfilesOrigin(value: string, origin: string): string {
  return value.startsWith('/') && !value.startsWith('//') ? `${origin}${value}` : value;
}

/** srcset: each candidate's URL, made absolute the same way. */
export function srcsetOnProfilesOrigin(value: string, origin: string): string {
  return value
    .split(',')
    .map((candidate) => {
      const [url, ...descriptor] = candidate.trim().split(/\s+/);
      return [onProfilesOrigin(url, origin), ...descriptor].join(' ');
    })
    .join(', ');
}

/**
 * Rewrites the rendered page for the practice host: assets, fonts, the
 * preview image and site links point at the profiles origin; links marked
 * PRACTICE_LOCAL_ATTR (the Book button) stay on the practice host.
 */
export function forPracticeHost(response: Response, config: ProfilesConfig): Response {
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response;
  const origin = config.publicOrigin;
  const attr = (name: string, fn: (v: string) => string) => ({
    element(el: Element) {
      if (el.hasAttribute(PRACTICE_LOCAL_ATTR)) {
        el.removeAttribute(PRACTICE_LOCAL_ATTR);
        return;
      }
      const value = el.getAttribute(name);
      if (value !== null) el.setAttribute(name, fn(value));
    },
  });
  const url = (v: string) => onProfilesOrigin(v, origin);
  return new HTMLRewriter()
    .on('a[href]', attr('href', url))
    .on('link[href]', attr('href', url))
    .on('script[src]', attr('src', url))
    .on('img[src]', attr('src', url))
    .on('img[srcset]', attr('srcset', (v) => srcsetOnProfilesOrigin(v, origin)))
    .on('source[srcset]', attr('srcset', (v) => srcsetOnProfilesOrigin(v, origin)))
    .on('form[action]', attr('action', url))
    .on('meta[property="og:image"]', attr('content', url))
    .transform(response);
}

export interface PracticeReview {
  id: string;
  rating: number | null;
  testimonial: string;
  displayName: string;
  publishedAt: string;
}

export interface PracticeReviews {
  averageRating: number | null;
  count: number;
  reviews: PracticeReview[];
}

/**
 * The practice's published client reviews (§6.16 Reviews), read from the
 * public API the practice page uses. Nothing from the visitor's request is
 * forwarded. A failure throws: the router then serves the practice page,
 * which shows the reviews itself, rather than this page caching without them.
 */
export async function practiceReviews(config: ProfilesConfig, slug: string, fetchImpl: typeof fetch = fetch): Promise<PracticeReviews> {
  const res = await fetchImpl(`${config.apiOrigin}/v1/intake/public/reviews`, {
    headers: { accept: 'application/json', 'x-tenant-slug': slug },
    redirect: 'manual',
  });
  if (!res.ok) throw new Error(`Reviews API answered ${res.status}`);
  const body = (await res.json()) as Partial<PracticeReviews>;
  const reviews = Array.isArray(body.reviews)
    ? body.reviews.filter(
        (r): r is PracticeReview =>
          typeof r?.id === 'string' && typeof r.displayName === 'string' && typeof r.testimonial === 'string' && (r.rating === null || (typeof r.rating === 'number' && r.rating >= 1 && r.rating <= 5)),
      )
    : [];
  return { averageRating: typeof body.averageRating === 'number' ? body.averageRating : null, count: reviews.length, reviews };
}
