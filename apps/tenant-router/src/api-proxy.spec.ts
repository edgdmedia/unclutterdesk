import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CLIENT_IP_HEADER,
  PRACTICE_HOST_HEADER,
  ROUTER_SECRET_HEADER,
  apiRequest,
  clientResponse,
  isAllowedClientRoute,
  isApiPath,
  rewriteSetCookie,
} from './api-proxy';
import worker, { type Env } from './index';

const setCookies = (r: Response) => (r.headers as unknown as { getSetCookie(): string[] }).getSetCookie();

const API = 'https://api.unclutterdesk.com';
const ENV: Env = {
  APEX_HOST: 'unclutterdesk.com',
  ORIGIN_HOST: 'app-unclutterdesk.pages.dev',
  API_BASE: API,
  ROUTER_PROXY_SECRET: 'router-secret',
};

describe('the /api path', () => {
  it.each(['/api', '/api/', '/api/v1/auth/login'])('%s is reserved', (p) => expect(isApiPath(p)).toBe(true));
  it.each(['/apis', '/book', '/', '/api-docs'])('%s is not', (p) => expect(isApiPath(p)).toBe(false));
});

describe('the client route allow-list (spec §6.16)', () => {
  it.each([
    ['POST', '/v1/auth/login'],
    ['POST', '/v1/auth/refresh'],
    ['POST', '/v1/auth/logout'],
    ['POST', '/v1/auth/client-signup'],
    ['GET', '/v1/consult/public/availability'],
    ['POST', '/v1/consult/public/bookings'],
    ['POST', '/v1/consult/public/bookings/42/confirm-payment'],
    ['GET', '/v1/consult/portal'],
    ['POST', '/v1/video/bookings/9/join'],
    ['GET', '/v1/assessments/public/abc123'],
    ['HEAD', '/v1/tenant/public/info'],
    ['GET', '/v1/consult/portal/'],
  ])('forwards %s %s', (method, path) => {
    expect(isAllowedClientRoute(method, path)).toBe(true);
  });

  it.each([
    ['GET', '/v1/admin/tenants'],
    ['POST', '/v1/admin/auth/login'],
    ['PATCH', '/v1/admin/tenants/1'],
    ['GET', '/v1/tenant/brand'],
    ['PATCH', '/v1/tenant/brand'],
    ['GET', '/v1/consult/practice/sessions'],
    ['GET', '/v1/billing/summary'],
    ['POST', '/v1/billing/paystack-webhook'],
    ['POST', '/v1/auth/register'],
    ['POST', '/v1/tenant/register'],
    ['POST', '/v1/auth/invite/claim'],
    ['GET', '/v1/tenant/entitlements'],
    ['GET', '/v1/auth/login'],
    ['OPTIONS', '/v1/auth/login'],
    ['GET', '/v1/consult/portal/extra'],
    ['GET', '/v1/assessments/public/abc/def'],
  ])('refuses %s %s', (method, path) => {
    expect(isAllowedClientRoute(method, path)).toBe(false);
  });
});

describe('the request sent to the API', () => {
  const browser = (headers: Record<string, string> = {}, init: RequestInit = {}) =>
    new Request('https://chente.com/api/v1/consult/public/availability?from=2026-11-01', {
      headers: { cookie: 'unclutter_access=a', 'cf-connecting-ip': '102.89.1.2', ...headers },
      ...init,
    });

  it('drops the /api prefix and keeps the query and cookies', () => {
    const req = apiRequest(browser(), { apiBase: API, practiceHost: 'chente.com', secret: 's' });
    expect(req.url).toBe(`${API}/v1/consult/public/availability?from=2026-11-01`);
    expect(req.headers.get('cookie')).toBe('unclutter_access=a');
  });

  it('replaces any router header the browser sent with the router own', () => {
    const forged = browser({ [ROUTER_SECRET_HEADER]: 'guess', [PRACTICE_HOST_HEADER]: 'other.com', [CLIENT_IP_HEADER]: '1.1.1.1' });
    const req = apiRequest(forged, { apiBase: API, practiceHost: 'chente.com', secret: 'router-secret' });
    expect(req.headers.get(ROUTER_SECRET_HEADER)).toBe('router-secret');
    expect(req.headers.get(PRACTICE_HOST_HEADER)).toBe('chente.com');
    expect(req.headers.get(CLIENT_IP_HEADER)).toBe('102.89.1.2');
  });

  it('sends no router headers at all when no secret is configured', () => {
    const forged = browser({ [PRACTICE_HOST_HEADER]: 'other.com' });
    const req = apiRequest(forged, { apiBase: API, practiceHost: 'chente.com', secret: undefined });
    for (const h of [ROUTER_SECRET_HEADER, PRACTICE_HOST_HEADER, CLIENT_IP_HEADER]) expect(req.headers.get(h)).toBeNull();
  });

  it('forwards the body of a write', async () => {
    const post = new Request('https://chente.com/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.ng' }),
      headers: { 'content-type': 'application/json', 'x-csrf-token': 't' },
    });
    const req = apiRequest(post, { apiBase: API, practiceHost: 'chente.com', secret: 's' });
    expect(req.method).toBe('POST');
    expect(req.headers.get('x-csrf-token')).toBe('t');
    expect(await req.text()).toBe('{"email":"a@b.ng"}');
  });
});

describe('cookies coming back', () => {
  it('lose their Domain, so they belong to the custom domain only', () => {
    expect(rewriteSetCookie('unclutter_csrf=x; Max-Age=2592000; Domain=.unclutterdesk.com; Path=/; Secure; SameSite=None')).toBe(
      'unclutter_csrf=x; Max-Age=2592000; Path=/; Secure; SameSite=None',
    );
  });

  it('move from Path=/v1/... to Path=/api/v1/..., so the refresh cookie is sent through the proxy', () => {
    expect(rewriteSetCookie('unclutter_refresh=r; Path=/v1/auth/refresh; HttpOnly; Secure; SameSite=None')).toBe(
      'unclutter_refresh=r; Path=/api/v1/auth/refresh; HttpOnly; Secure; SameSite=None',
    );
  });

  it('rewrite the sign-out clearing cookies the same way, so the old ones are really removed', () => {
    expect(rewriteSetCookie('unclutter_refresh=; Path=/v1/auth/refresh; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly')).toBe(
      'unclutter_refresh=; Path=/api/v1/auth/refresh; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly',
    );
  });

  it('leave Path=/ alone, and match attributes case-insensitively', () => {
    expect(rewriteSetCookie('unclutter_access=a; path=/; domain=api.unclutterdesk.com; HttpOnly')).toBe('unclutter_access=a; path=/; HttpOnly');
  });

  it('are all rewritten when a response sets several', async () => {
    const headers = new Headers({ 'content-type': 'application/json' });
    headers.append('set-cookie', 'unclutter_access=a; Path=/; HttpOnly');
    headers.append('set-cookie', 'unclutter_refresh=r; Path=/v1/auth/refresh; HttpOnly');
    headers.append('set-cookie', 'unclutter_csrf=c; Domain=.unclutterdesk.com; Path=/');
    const out = clientResponse(new Response('{"ok":true}', { status: 201, headers }));
    expect(out.status).toBe(201);
    expect(setCookies(out)).toEqual([
      'unclutter_access=a; Path=/; HttpOnly',
      'unclutter_refresh=r; Path=/api/v1/auth/refresh; HttpOnly',
      'unclutter_csrf=c; Path=/',
    ]);
    expect(await out.text()).toBe('{"ok":true}');
  });
});

describe('the Worker on /api', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (input: Request | string) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/v1/tenant/public/exists/')) {
        return new Response(JSON.stringify({ exists: url.includes('chente.com'), active: true }), { status: 200 });
      }
      const headers = new Headers();
      headers.append('set-cookie', 'unclutter_refresh=r; Path=/v1/auth/refresh; HttpOnly');
      return new Response('{"ok":true}', { status: 200, headers });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('caches', { default: { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) } });
  });
  afterEach(() => vi.unstubAllGlobals());

  const call = (url: string, init: RequestInit = {}) => worker.fetch(new Request(url, init), ENV);
  const apiCalls = () => fetchMock.mock.calls.map(([r]) => (typeof r === 'string' ? r : r.url)).filter((u) => !u.includes('/public/exists/'));

  it('proxies an allowed client route on an ACTIVE custom domain, with cookies rewritten', async () => {
    const res = await call('https://chente.com/api/v1/auth/refresh', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(apiCalls()).toEqual([`${API}/v1/auth/refresh`]);
    expect(setCookies(res)).toEqual(['unclutter_refresh=r; Path=/api/v1/auth/refresh; HttpOnly']);
    const sent = fetchMock.mock.calls.find(([r]) => typeof r !== 'string' && r.url.endsWith('/v1/auth/refresh'))![0] as Request;
    expect(sent.headers.get(PRACTICE_HOST_HEADER)).toBe('chente.com');
    expect(sent.headers.get(ROUTER_SECRET_HEADER)).toBe('router-secret');
  });

  it.each([
    'https://chente.com/api/v1/admin/tenants',
    'https://chente.com/api/v1/tenant/brand',
    'https://chente.com/api/v1/consult/practice/sessions',
    'https://chente.com/api',
  ])('refuses %s with a JSON 404, never forwarding it', async (url) => {
    const res = await call(url);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(apiCalls()).toEqual([]);
  });

  it('refuses a custom domain that is not ACTIVE (the lookup says it does not exist)', async () => {
    const res = await call('https://not-active.example/api/v1/auth/login', { method: 'POST' });
    expect(res.status).toBe(404);
    expect(apiCalls()).toEqual([]);
  });

  it.each(['https://dr-smith.unclutterdesk.com/api/v1/auth/login', 'https://app.unclutterdesk.com/api/v1/auth/login'])(
    'answers /api with a 404 on %s: only custom domains proxy',
    async (url) => {
      const res = await call(url, { method: 'POST' });
      expect(res.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('still serves the app for everything outside /api', async () => {
    fetchMock.mockResolvedValue(new Response('<html></html>', { status: 200 }));
    const res = await call('https://dr-smith.unclutterdesk.com/book');
    expect(res.status).toBe(200);
    expect((fetchMock.mock.calls.at(-1)![0] as Request).url).toBe('https://app-unclutterdesk.pages.dev/book');
  });
});
