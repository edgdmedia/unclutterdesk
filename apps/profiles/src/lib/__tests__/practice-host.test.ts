import { describe, expect, it, vi } from 'vitest';
import {
  PRACTICE_SLUG_HEADER,
  onProfilesOrigin,
  practiceHostRequest,
  practiceReviews,
  practiceSlug,
  publicRequest,
  srcsetOnProfilesOrigin,
} from '../practice-host';
import { profilesConfig } from '../config';
import { practiceTag, purgeTags } from '../purge';
import { securityHeaders } from '../security';

/** §6.16 one page, two addresses: the pieces the PracticeHost entrypoint is built from. */
const config = profilesConfig({ PROFILE_PUBLIC_URL: 'https://profiles.test', API_URL: 'https://api.test', MEDIA_URL: 'https://media.test' });

describe('the practice-host page can only be asked for by the router', () => {
  it('drops a practice header a visitor sends to therapysts.com', () => {
    const forged = new Request('https://profiles.test/ada-obi', { headers: { [PRACTICE_SLUG_HEADER]: 'ada', accept: 'text/html' } });
    const req = publicRequest(forged);
    expect(req.headers.get(PRACTICE_SLUG_HEADER)).toBeNull();
    expect(req.headers.get('accept')).toBe('text/html');
  });

  it('takes the practice from the binding request, and forwards nothing that identifies the visitor', () => {
    const req = practiceHostRequest(
      new Request('https://ada.unclutterdesk.test/ada-obi?practice=ada', {
        headers: { cookie: 'unclutter_access=secret', authorization: 'Bearer x', 'accept-language': 'en-NG', 'user-agent': 'UA' },
      }),
    )!;
    expect(req.headers.get(PRACTICE_SLUG_HEADER)).toBe('ada');
    expect(req.headers.get('cookie')).toBeNull();
    expect(req.headers.get('authorization')).toBeNull();
    expect(req.headers.get('accept-language')).toBe('en-NG');
    expect(new URL(req.url).pathname).toBe('/ada-obi');
  });

  it('refuses anything that is not a GET or HEAD of one profile for one practice', () => {
    for (const [url, method] of [
      ['https://h.test/ada-obi', 'GET'],
      ['https://h.test/ada-obi?practice=Not_A_Slug', 'GET'],
      ['https://h.test/ada-obi/report?practice=ada', 'GET'],
      ['https://h.test/api/purge?practice=ada', 'GET'],
      ['https://h.test/ada-obi?practice=ada', 'POST'],
    ] as const) {
      expect(practiceHostRequest(new Request(url, { method }))).toBeNull();
    }
  });

  it('accepts only practice slugs', () => {
    expect(practiceSlug('ada')).toBe('ada');
    expect(practiceSlug('dr-ada-2')).toBe('dr-ada-2');
    for (const bad of ['', '-ada', 'ada-', 'Ada', 'a'.repeat(51), 'ada.com', null, undefined]) expect(practiceSlug(bad as string)).toBeNull();
  });
});

describe('links work from both addresses', () => {
  it('points root-relative links at the profiles origin and leaves the rest', () => {
    expect(onProfilesOrigin('/_astro/profile.css', config.publicOrigin)).toBe('https://profiles.test/_astro/profile.css');
    expect(onProfilesOrigin('/ada-obi/report', config.publicOrigin)).toBe('https://profiles.test/ada-obi/report');
    for (const kept of ['https://media.test/a.webp', '//cdn.test/x', '#main', 'mailto:ada@example.com']) {
      expect(onProfilesOrigin(kept, config.publicOrigin)).toBe(kept);
    }
    expect(srcsetOnProfilesOrigin('/a.png 1x, /a@2x.png 2x', config.publicOrigin)).toBe('https://profiles.test/a.png 1x, https://profiles.test/a@2x.png 2x');
  });

  it('allows the profiles origin in the CSP on the practice host only', () => {
    const own = securityHeaders(config)['Content-Security-Policy'];
    const practice = securityHeaders(config, { practiceHost: true })['Content-Security-Policy'];
    expect(own).toContain("style-src 'self';");
    expect(practice).toContain("style-src 'self' https://profiles.test;");
    expect(practice).toContain("font-src 'self' https://profiles.test;");
    expect(practice).toContain("script-src 'self' https://profiles.test;");
    expect(practice).toContain("frame-ancestors 'none'");
  });
});

describe("the practice's reviews", () => {
  it("reads them from the practice's public API, sending nothing from the visitor", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        averageRating: 4.5,
        count: 2,
        reviews: [
          { id: '1', rating: 5, testimonial: 'Kind and clear.', displayName: 'Tolu A.', publishedAt: '2026-11-01T00:00:00.000Z' },
          { id: '2', rating: null, testimonial: 'Helped a lot.', displayName: 'Anonymous', publishedAt: '2026-11-02T00:00:00.000Z' },
          { id: 3, rating: 9, testimonial: '<script>', displayName: 'Bad row' },
        ],
      }),
    );
    const reviews = await practiceReviews(config, 'ada', fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith('https://api.test/v1/intake/public/reviews', {
      headers: { accept: 'application/json', 'x-tenant-slug': 'ada' },
      redirect: 'manual',
    });
    expect(reviews.count).toBe(2);
    expect(reviews.reviews.map((r) => r.displayName)).toEqual(['Tolu A.', 'Anonymous']);
    expect(reviews.averageRating).toBe(4.5);
  });

  it('throws when the API fails, so the router serves the practice page instead', async () => {
    const fetchImpl = vi.fn(async () => new Response('down', { status: 503 }));
    await expect(practiceReviews(config, 'ada', fetchImpl as unknown as typeof fetch)).rejects.toThrow(/503/);
  });

  it('can be purged by practice', () => {
    expect(practiceTag('ada')).toBe('practice:ada');
    expect(purgeTags({ tags: ['practice:ada', 'profile:ada-obi'] })).toEqual(['practice:ada', 'profile:ada-obi']);
    expect(purgeTags({ tags: ['practice:Ada'] })).toBeNull();
  });
});
