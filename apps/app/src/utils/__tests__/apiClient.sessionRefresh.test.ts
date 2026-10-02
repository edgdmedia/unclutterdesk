import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, setSessionExpiredHandler } from '../apiClient';

/**
 * The sign-in check (/v1/auth/status) runs on every page load. The access
 * cookie lasts 15 minutes and the refresh cookie is only sent to
 * /v1/auth/refresh, so after a quiet spell the check fails until the session
 * is refreshed. It used to give up there and sign the person out, while the
 * page's other requests refreshed and loaded their data: a portal showing the
 * client's sessions under "Sign in to see your sessions".
 */
function reply(status: number, body: unknown = {}) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  setSessionExpiredHandler(() => {});
});

describe('the sign-in check after the access cookie expired', () => {
  it('refreshes the session and checks again, keeping the person signed in', async () => {
    let statusCalls = 0;
    const fetch = vi.fn((url: string) => {
      if (url.endsWith('/v1/auth/refresh')) return reply(200, { csrfToken: 'x' });
      if (url.endsWith('/v1/auth/status')) return ++statusCalls === 1 ? reply(401) : reply(200, { email: 'ada@example.com', type: 'user' });
      return reply(404);
    });
    vi.stubGlobal('fetch', fetch);
    const expired = vi.fn();
    setSessionExpiredHandler(expired);

    await expect(api.get('/v1/auth/status')).resolves.toMatchObject({ email: 'ada@example.com' });
    expect(fetch.mock.calls.map((c) => new URL(String(c[0]), 'http://x').pathname)).toEqual([
      '/v1/auth/status',
      '/v1/auth/refresh',
      '/v1/auth/status',
    ]);
    expect(expired).not.toHaveBeenCalled();
  });

  it('signs out only when the refresh fails too', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => (url.endsWith('/v1/auth/logout') ? reply(200) : reply(401))));
    const expired = vi.fn();
    setSessionExpiredHandler(expired);

    await expect(api.get('/v1/auth/status')).rejects.toThrow();
    expect(expired).toHaveBeenCalledTimes(1);
  });
});
