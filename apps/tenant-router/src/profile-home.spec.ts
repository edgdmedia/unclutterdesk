import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { type Env } from './index';
import { lookupTenant } from './tenants';

/**
 * §6.16 "One page, two addresses": a solo practice whose owner has published
 * shows the owner's profile page at `/`. The router asks the profiles Worker's
 * PracticeHost entrypoint for it over the PROFILES service binding. Everything
 * except `/` is unchanged. The network is faked: the API probe and the Pages
 * origin (global fetch) and the profiles Worker (the binding).
 */
const API = 'https://api.unclutterdesk.com';
const ORIGIN = 'app-unclutterdesk.pages.dev';
const SOLO = { exists: true, active: true, homePage: 'PROFILE', profileHandle: 'ada-obi', practiceSlug: 'ada' };
const TEAM = { exists: true, active: true, homePage: 'PRACTICE' };

let probe: Record<string, unknown>;
let originFetch: ReturnType<typeof vi.fn>;
let profiles: { fetch: ReturnType<typeof vi.fn> };

function env(over: Partial<Env> = {}): Env {
  return {
    APEX_HOST: 'unclutterdesk.com',
    MARKETING_URL: 'https://unclutterdesk.com',
    ORIGIN_HOST: ORIGIN,
    API_BASE: API,
    PROFILES: profiles as unknown as Fetcher,
    ...over,
  };
}

const profilePage = () =>
  new Response('<html>profile page</html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'set-cookie': 'leak=1', 'cache-control': 'public, max-age=60' },
  });

beforeEach(() => {
  probe = SOLO;
  vi.stubGlobal('caches', { default: { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) } });
  originFetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith(`${API}/v1/tenant/public/exists/`)) return Response.json(probe, { headers: { 'cache-control': 'public, max-age=60' } });
    if (new URL(url).hostname === ORIGIN) return new Response('<html>practice app</html>', { headers: { 'content-type': 'text/html' } });
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal('fetch', originFetch);
  profiles = { fetch: vi.fn(async () => profilePage()) };
});
afterEach(() => vi.unstubAllGlobals());

const visit = (url: string, init: RequestInit = {}, e: Env = env()) => worker.fetch(new Request(url, init), e);

describe("a solo practice's address shows the owner's profile at / (§6.16)", () => {
  it('asks the profiles Worker for the owner\'s page, for this practice, with nothing from the visitor', async () => {
    const res = await visit('https://ada.unclutterdesk.com/', {
      headers: { cookie: 'unclutter_access=secret', authorization: 'Bearer x', 'accept-language': 'en-NG' },
    });
    expect(await res.text()).toBe('<html>profile page</html>');
    expect(profiles.fetch).toHaveBeenCalledTimes(1);
    const sent: Request = profiles.fetch.mock.calls[0][0];
    const url = new URL(sent.url);
    expect(url.pathname).toBe('/ada-obi');
    expect(url.searchParams.get('practice')).toBe('ada');
    expect(sent.headers.get('cookie')).toBeNull();
    expect(sent.headers.get('authorization')).toBeNull();
    expect(sent.headers.get('accept-language')).toBe('en-NG');
  });

  it('never passes a cookie back to the visitor', async () => {
    const res = await visit('https://ada.unclutterdesk.com/');
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('keeps practice subdomains out of search, so the profile address is listed once', async () => {
    expect((await visit('https://ada.unclutterdesk.com/')).headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('serves it on the custom domain too, without a redirect and indexable (the page carries the canonical)', async () => {
    const res = await visit('https://adaobi.com/');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<html>profile page</html>');
    expect(res.headers.get('x-robots-tag')).toBeNull();
  });

  it('ignores a query string on / and never forwards it', async () => {
    await visit('https://ada.unclutterdesk.com/?utm_source=instagram&fbclid=abc');
    const url = new URL(profiles.fetch.mock.calls[0][0].url);
    expect([...url.searchParams.keys()]).toEqual(['practice']);
  });

  it('answers HEAD the same way', async () => {
    await visit('https://ada.unclutterdesk.com/', { method: 'HEAD' });
    expect(profiles.fetch.mock.calls[0][0].method).toBe('HEAD');
  });
});

describe('everything else is unchanged', () => {
  it.each(['/book', '/login', '/session/12', '/set-password', '/assessment/tok', '/review?booking=1'])('%s goes to the app', async (path) => {
    const res = await visit(`https://ada.unclutterdesk.com${path}`);
    expect(await res.text()).toBe('<html>practice app</html>');
    expect(profiles.fetch).not.toHaveBeenCalled();
  });

  it('a team practice, or an owner who chose the practice page, keeps the practice page', async () => {
    probe = TEAM;
    expect(await (await visit('https://ada.unclutterdesk.com/')).text()).toBe('<html>practice app</html>');
    expect(profiles.fetch).not.toHaveBeenCalled();
  });

  it('a POST to / goes to the app', async () => {
    await visit('https://ada.unclutterdesk.com/', { method: 'POST', body: 'x' });
    expect(profiles.fetch).not.toHaveBeenCalled();
  });

  it('serves the practice page when the profiles Worker fails or answers anything but 200', async () => {
    for (const failure of [async () => new Response('gone', { status: 404 }), async () => new Response('oops', { status: 500 }), async () => { throw new Error('binding down'); }]) {
      profiles.fetch = vi.fn(failure);
      const res = await visit('https://ada.unclutterdesk.com/');
      expect(await res.text()).toBe('<html>practice app</html>');
      expect(res.status).toBe(200);
    }
  });

  it('serves the practice page when the binding is missing', async () => {
    const res = await visit('https://ada.unclutterdesk.com/', {}, env({ PROFILES: undefined }));
    expect(await res.text()).toBe('<html>practice app</html>');
  });
});

describe('reading the probe', () => {
  const cache = () => ({ match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) }) as unknown as Cache;

  it("takes the owner's handle and the practice only for a valid PROFILE answer", async () => {
    probe = SOLO;
    expect((await lookupTenant('ada.unclutterdesk.com', API, cache())).profileHome).toEqual({ handle: 'ada-obi', practiceSlug: 'ada' });

    for (const bad of [
      TEAM,
      { ...SOLO, profileHandle: '../admin' },
      { ...SOLO, practiceSlug: 'Not A Slug' },
      { ...SOLO, profileHandle: undefined },
      { ...SOLO, homePage: 'SOMETHING' },
    ]) {
      probe = bad;
      expect((await lookupTenant('ada.unclutterdesk.com', API, cache())).profileHome).toBeUndefined();
    }
  });
});

describe('a cached probe answer', () => {
  it('keeps both the old-address redirect (§6.2) and the profile home (§6.16)', async () => {
    const stored = new Map<string, Response>();
    const cache = {
      match: vi.fn(async (req: Request) => stored.get(req.url)?.clone()),
      put: vi.fn(async (req: Request, res: Response) => void stored.set(req.url, res.clone())),
    } as unknown as Cache;
    probe = { ...SOLO, redirectTo: 'ada-new' };
    const fresh = await lookupTenant('ada.unclutterdesk.com', API, cache);
    const cached = await lookupTenant('ada.unclutterdesk.com', API, cache);
    expect(cache.match).toHaveBeenCalledTimes(2);
    expect(cached).toEqual(fresh);
    expect(cached).toMatchObject({ redirectTo: 'ada-new', profileHome: { handle: 'ada-obi', practiceSlug: 'ada' } });
  });
});

describe('wrangler.jsonc', () => {
  const config = readFileSync(resolve(__dirname, '../wrangler.jsonc'), 'utf8')
    .split('\n')
    .map((line) => line.replace(/^\s*\/\/.*$/, ''))
    .join('\n');

  it("binds PROFILES to the profiles Worker's PracticeHost entrypoint", () => {
    expect(config).toMatch(/"services"\s*:\s*\[\s*\{\s*"binding"\s*:\s*"PROFILES"\s*,\s*"service"\s*:\s*"therapysts-profiles"\s*,\s*"entrypoint"\s*:\s*"PracticeHost"\s*\}\s*\]/);
  });
});
