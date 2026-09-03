import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lookupTenant } from './tenants';

const API = 'https://api.example.com';

function emptyCache() {
  return {
    match: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
  } as unknown as Cache;
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('lookupTenant', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports a practice that exists and is active', async () => {
    (fetch as any).mockResolvedValue(jsonResponse({ exists: true, active: true }));
    await expect(lookupTenant('dr-smith.unclutterdesk.com', API, emptyCache())).resolves.toEqual({
      exists: true,
      active: true,
    });
  });

  it('reports a practice that exists but is deactivated', async () => {
    (fetch as any).mockResolvedValue(jsonResponse({ exists: true, active: false }));
    // Still exists, so the caller serves the app rather than a 404 — clients
    // with booked sessions must reach the inactive-practice page.
    await expect(lookupTenant('paused.unclutterdesk.com', API, emptyCache())).resolves.toEqual({
      exists: true,
      active: false,
    });
  });

  it('reports a practice that does not exist', async () => {
    (fetch as any).mockResolvedValue(jsonResponse({ exists: false, active: false }));
    await expect(lookupTenant('nope.unclutterdesk.com', API, emptyCache())).resolves.toEqual({
      exists: false,
      active: false,
    });
  });

  it('queries the host, url-encoded', async () => {
    (fetch as any).mockResolvedValue(jsonResponse({ exists: true, active: true }));
    await lookupTenant('dr-smith.unclutterdesk.com', API, emptyCache());
    expect((fetch as any).mock.calls[0][0]).toBe(
      `${API}/v1/tenant/public/exists/dr-smith.unclutterdesk.com`,
    );
  });

  // A wrong 404 removes a real practice from the internet; a wrong 200 only
  // shows the app's own not-found screen. Every uncertain path serves the app.
  describe('fails open', () => {
    it('when the API is unreachable', async () => {
      (fetch as any).mockRejectedValue(new Error('network'));
      await expect(lookupTenant('x.unclutterdesk.com', API, emptyCache())).resolves.toMatchObject({
        exists: true,
      });
    });

    it('when the API times out', async () => {
      (fetch as any).mockRejectedValue(
        Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
      );
      await expect(lookupTenant('x.unclutterdesk.com', API, emptyCache())).resolves.toMatchObject({
        exists: true,
      });
    });

    it('when the API returns 500', async () => {
      (fetch as any).mockResolvedValue(jsonResponse({ error: 'boom' }, { status: 500 }));
      await expect(lookupTenant('x.unclutterdesk.com', API, emptyCache())).resolves.toMatchObject({
        exists: true,
      });
    });

    it('when the API returns 404 for the probe itself', async () => {
      // e.g. the endpoint has not been deployed yet — must not be read as
      // "practice missing", which would 404 every single practice.
      (fetch as any).mockResolvedValue(jsonResponse({ message: 'Cannot GET' }, { status: 404 }));
      await expect(lookupTenant('x.unclutterdesk.com', API, emptyCache())).resolves.toMatchObject({
        exists: true,
      });
    });

    it('when the body is not JSON', async () => {
      (fetch as any).mockResolvedValue(new Response('<html>gateway</html>', { status: 200 }));
      await expect(lookupTenant('x.unclutterdesk.com', API, emptyCache())).resolves.toMatchObject({
        exists: true,
      });
    });

    it('when the body is JSON of the wrong shape', async () => {
      (fetch as any).mockResolvedValue(jsonResponse({ unexpected: true }));
      await expect(lookupTenant('x.unclutterdesk.com', API, emptyCache())).resolves.toMatchObject({
        exists: true,
      });
    });

    it('when the cache read throws', async () => {
      const cache = {
        match: vi.fn().mockRejectedValue(new Error('cache down')),
        put: vi.fn().mockResolvedValue(undefined),
      } as unknown as Cache;
      (fetch as any).mockResolvedValue(jsonResponse({ exists: false, active: false }));
      // A broken cache must not change the answer — it still asks the API.
      await expect(lookupTenant('x.unclutterdesk.com', API, cache)).resolves.toMatchObject({
        exists: false,
      });
    });

    it('when the cache write throws', async () => {
      const cache = {
        match: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockRejectedValue(new Error('quota')),
      } as unknown as Cache;
      (fetch as any).mockResolvedValue(jsonResponse({ exists: true, active: true }));
      await expect(lookupTenant('x.unclutterdesk.com', API, cache)).resolves.toMatchObject({
        exists: true,
      });
    });
  });

  describe('caching', () => {
    it('serves a cached answer without calling the API', async () => {
      const cache = {
        match: vi.fn().mockResolvedValue(jsonResponse({ exists: false, active: false })),
        put: vi.fn(),
      } as unknown as Cache;

      await expect(lookupTenant('x.unclutterdesk.com', API, cache)).resolves.toEqual({
        exists: false,
        active: false,
      });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('keys the cache per host, not per path', async () => {
      const cache = emptyCache();
      (fetch as any).mockResolvedValue(jsonResponse({ exists: true, active: true }));
      await lookupTenant('dr-smith.unclutterdesk.com', API, cache);

      const key = (cache.match as any).mock.calls[0][0] as Request;
      expect(key.url).toContain('dr-smith.unclutterdesk.com');
      expect((cache.put as any).mock.calls[0][0].url).toBe(key.url);
    });

    it('stores the response so the API Cache-Control governs the TTL', async () => {
      const cache = emptyCache();
      (fetch as any).mockResolvedValue(
        jsonResponse({ exists: true, active: true }, { headers: { 'cache-control': 'public, max-age=300' } }),
      );
      await lookupTenant('x.unclutterdesk.com', API, cache);
      expect(cache.put).toHaveBeenCalled();
    });
  });
});
