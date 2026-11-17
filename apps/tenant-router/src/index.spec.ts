import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { type Env } from './index';

/**
 * §6.2: a practice that renames its booking address keeps answering on the old
 * one with a permanent redirect to the current slug, so a link a client saved
 * still works.
 */
const ENV: Env = {
  APEX_HOST: 'unclutterdesk.com',
  ORIGIN_HOST: 'app-unclutterdesk.pages.dev',
  MARKETING_URL: 'https://unclutterdesk.com',
  API_BASE: 'https://api.unclutterdesk.com',
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function emptyCache() {
  return { match: vi.fn().mockResolvedValue(undefined), put: vi.fn() };
}

function call(request: Request) {
  return worker.fetch(request, ENV);
}

describe('old practice slug (§6.2)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('caches', { default: emptyCache() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('301-redirects an old slug to the current one, keeping the path and query', async () => {
    (fetch as any).mockResolvedValue(
      jsonResponse({ exists: true, active: true, redirectTo: 'dr-smith-new' }),
    );

    const response = await call(
      new Request('https://dr-smith-old.unclutterdesk.com/book?ref=card'),
    );

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(
      'https://dr-smith-new.unclutterdesk.com/book?ref=card',
    );
  });

  it('does not redirect a current slug', async () => {
    (fetch as any).mockResolvedValue(jsonResponse({ exists: true, active: true }));
    const origin = new Response('<html>app</html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });
    // First fetch is the exists probe; the second serves the app bundle.
    (fetch as any)
      .mockResolvedValueOnce(jsonResponse({ exists: true, active: true }))
      .mockResolvedValueOnce(origin);

    const response = await call(new Request('https://dr-smith.unclutterdesk.com/book'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('404s a slug that never existed', async () => {
    (fetch as any).mockResolvedValue(jsonResponse({ exists: false, active: false }));

    const response = await call(new Request('https://nope.unclutterdesk.com/book'));

    expect(response.status).toBe(404);
  });
});