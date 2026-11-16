/**
 * §6.16 end to end in the Workers runtime (workerd, under `wrangler dev`):
 * the real tenant router, bound to the real built profiles Worker's
 * PracticeHost entrypoint by its PROFILES service binding, both in one
 * runtime as in one Cloudflare account. Only the API (and the app's Pages
 * origin) is faked, by a local HTTP server.
 *
 * Run with `pnpm --filter @unclutterdesk/profiles test:workerd`, which builds
 * the profiles Worker first. Not part of `pnpm test`: it starts workerd.
 *
 * Not covered here: purging. Workers Caching's purge isn't available in the
 * local runtime (`cache.purge is not a function`), for the existing
 * therapysts.com purge as much as for PracticeHost's.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import http, { type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PROFILES_DIR = resolve(__dirname, '..');
const PROFILES_ORIGIN = 'https://profiles.example.test';

const PROFILE = {
  handle: 'ada-obi', displayName: 'Dr Ada Obi', kind: 'PSYCHOLOGIST', headline: 'Calm, practical support', about: 'I help adults with anxiety.',
  pronouns: null, city: 'Lagos', countryCode: 'NG', photoUrl: null, previewImageUrl: null, themeKey: 'calm', layoutKey: 'classic', brandColor: null,
  acceptingClients: true, offersOnline: true, offersInPerson: false, bookingMode: 'DESK', deskBookingUrl: 'https://ada.example.test/book',
  externalBookingUrl: null, contactEmail: null, credentialsText: null, supervisedBy: null, timeline: [], specialties: [], modalities: [],
  populations: [], languages: [], faithIntegration: null, approach: null, yearsInPractice: null, feeRangeText: null, socialLinks: [],
  publishedAt: '2026-11-01T00:00:00.000Z',
};
const REVIEWS = {
  averageRating: 5,
  count: 1,
  reviews: [{ id: '1', rating: 5, testimonial: 'Kind & clear <b>always</b>.', displayName: 'Tolu A.', publishedAt: '2026-11-02T00:00:00.000Z' }],
};

// Every request the Workers made to the fake API, with its headers.
const calls: { url: string; headers: IncomingHttpHeaders }[] = [];

function fakeApi(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = req.url ?? '/';
  calls.push({ url, headers: req.headers });
  const json = (body: unknown) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  };
  if (url.startsWith('/v1/tenant/public/exists/')) {
    const host = decodeURIComponent(url.split('/').pop()!);
    return json(
      host === 'ada.example.test' || host === 'adaobi.test'
        ? { exists: true, active: true, homePage: 'PROFILE', profileHandle: 'ada-obi', practiceSlug: 'ada' }
        : { exists: true, active: true, homePage: 'PRACTICE' },
    );
  }
  if (url === '/v1/profiles/ada-obi') return json({ profile: PROFILE });
  if (url === '/v1/intake/public/reviews') return json(req.headers['x-tenant-slug'] === 'ada' ? REVIEWS : { averageRating: null, count: 0, reviews: [] });
  // Anything else is the app's Pages origin serving the practice page.
  res.setHeader('content-type', 'text/html');
  res.end('<html>practice app</html>');
}

/** A GET through a Worker under `wrangler dev`, naming the host it is for (fetch can't set Host). */
function get(port: number, host: string, path: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; headers: IncomingHttpHeaders; body: string }>((done, fail) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET', headers: { host, ...headers } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => done({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', fail);
    req.end();
  });
}

let api: http.Server;
let work: string;
const devs: ChildProcess[] = [];
let routerPort = 0;
let profilesPort = 0;

/** Starts `wrangler dev` and resolves with its port once it says it's ready. */
function wranglerDev(args: string[]): Promise<number> {
  return new Promise((done, fail) => {
    const child = spawn('pnpm', ['exec', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', '0', '--persist-to', mkdtempSync(join(work, 'state-')), ...args], {
      cwd: PROFILES_DIR,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' },
    });
    devs.push(child);
    let log = '';
    const onData = (chunk: Buffer) => {
      log += chunk.toString();
      const ready = /Ready on http:\/\/127\.0\.0\.1:(\d+)/.exec(log);
      if (ready) done(Number(ready[1]));
      if (/\bERROR\b/.test(log)) fail(new Error(`wrangler dev failed:\n${log}`));
    };
    child.stdout!.on('data', onData);
    child.stderr!.on('data', onData);
    child.on('exit', (code) => fail(new Error(`wrangler dev exited ${code}:\n${log}`)));
  });
}

beforeAll(async () => {
  work = mkdtempSync(join(tmpdir(), 'practice-host-'));
  api = http.createServer(fakeApi).listen(0, '127.0.0.1');
  await new Promise((r) => api.once('listening', r));
  const apiBase = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;

  // The built profiles Worker's config, pointed at the fake API. Written next
  // to the built one so its relative main and assets paths still resolve.
  const built = JSON.parse(readFileSync(join(PROFILES_DIR, 'dist/server/wrangler.json'), 'utf8'));
  delete built.routes;
  Object.assign(built.vars, { API_URL: apiBase, PROFILE_PUBLIC_URL: PROFILES_ORIGIN, MEDIA_URL: 'https://media.example.test' });
  writeFileSync(join(PROFILES_DIR, 'dist/server/wrangler.workerd-test.json'), JSON.stringify(built));
  const profilesConfig = 'dist/server/wrangler.workerd-test.json';

  [routerPort, profilesPort] = await Promise.all([
    // The router first (it gets the port), with the profiles Worker beside it for the binding.
    wranglerDev([
      '-c', '../tenant-router/wrangler.jsonc', '-c', profilesConfig,
      '--var', 'APEX_HOST:example.test', '--var', `ORIGIN_HOST:${apiBase.slice('http://'.length)}`, '--var', 'ORIGIN_PROTOCOL:http:', '--var', `API_BASE:${apiBase}`,
    ]),
    // The profiles Worker on its own, as therapysts.com.
    wranglerDev(['-c', profilesConfig]),
  ]);
}, 240_000);

afterAll(async () => {
  for (const child of devs) child.kill('SIGTERM');
  api?.close();
  rmSync(join(PROFILES_DIR, 'dist/server/wrangler.workerd-test.json'), { force: true });
  if (work) rmSync(work, { recursive: true, force: true });
});

describe("a solo practice's / is the owner's profile page (§6.16, in workerd)", () => {
  it('comes through the binding, with the practice reviews, and nothing from the visitor', async () => {
    calls.length = 0;
    const res = await get(routerPort, 'ada.example.test', '/', { cookie: 'unclutter_access=secret', authorization: 'Bearer x' });
    expect(res.status).toBe(200);
    expect(res.body).toContain('<h1>Dr Ada Obi</h1>');
    expect(res.body).toContain('<h2 id="reviews">Reviews</h2>');
    // Client text is escaped, never markup.
    expect(res.body).toContain('Kind &amp; clear &lt;b&gt;always&lt;/b&gt;.');
    expect(res.body).toContain('Tolu A.');
    const profileCalls = calls.filter((c) => c.url === '/v1/profiles/ada-obi' || c.url === '/v1/intake/public/reviews');
    expect(profileCalls).toHaveLength(2);
    for (const call of profileCalls) {
      expect(call.headers.cookie).toBeUndefined();
      expect(call.headers.authorization).toBeUndefined();
    }
    expect(profileCalls.find((c) => c.url === '/v1/intake/public/reviews')!.headers['x-tenant-slug']).toBe('ada');
  });

  it('keeps Book on the practice host and points everything else at the profiles origin', async () => {
    const { body } = await get(routerPort, 'ada.example.test', '/');
    expect(body).toMatch(/<a class="btn" href="\/book">Book a session<\/a>/);
    expect(body).not.toContain('data-practice-local');
    expect(body).toContain(`<link rel="canonical" href="${PROFILES_ORIGIN}/ada-obi">`);
    expect(body).toContain(`href="${PROFILES_ORIGIN}/ada-obi/report"`);
    expect(body).toMatch(new RegExp(`<link rel="stylesheet" href="${PROFILES_ORIGIN}/_astro/[^"]+\\.css">`));
    expect(body).toMatch(new RegExp(`<img src="${PROFILES_ORIGIN}/_astro/[^"]+\\.svg"`));
    // The only root-relative URL left on the page is Book.
    const relative = [...body.matchAll(/(?:href|src)="(\/(?!\/)[^"]*)"/g)].map((m) => m[1]);
    expect(new Set(relative)).toEqual(new Set(['/book']));
  });

  it('sends a CSP that lets those load, never a cookie, and noindex on the subdomain', async () => {
    const { headers } = await get(routerPort, 'ada.example.test', '/');
    const csp = String(headers['content-security-policy']);
    expect(csp).toContain(`style-src 'self' ${PROFILES_ORIGIN}`);
    expect(csp).toContain(`font-src 'self' ${PROFILES_ORIGIN}`);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(headers['set-cookie']).toBeUndefined();
    expect(headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('is served on the custom domain without a redirect, and indexable', async () => {
    const res = await get(routerPort, 'adaobi.test', '/');
    expect(res.status).toBe(200);
    expect(res.body).toContain('<h1>Dr Ada Obi</h1>');
    expect(res.headers['x-robots-tag']).toBeUndefined();
  });

  it('leaves every other path, and team practices, to the app', async () => {
    expect((await get(routerPort, 'ada.example.test', '/book')).body).toBe('<html>practice app</html>');
    expect((await get(routerPort, 'team.example.test', '/')).body).toBe('<html>practice app</html>');
  });
});

describe('the profile address is unchanged', () => {
  it('never shows reviews, and Book goes to the main place', async () => {
    const { body } = await get(profilesPort, 'profiles.example.test', '/ada-obi');
    expect(body).toContain('<h1>Dr Ada Obi</h1>');
    expect(body).not.toContain('id="reviews"');
    expect(body).toContain('href="https://ada.example.test/book"');
  });

  it("can't be switched into practice-host mode by a visitor", async () => {
    calls.length = 0;
    const res = await get(profilesPort, 'profiles.example.test', '/ada-obi?practice=ada', { 'x-practice-slug': 'ada' });
    expect(res.body).not.toContain('id="reviews"');
    expect(String(res.headers['content-security-policy'])).toContain("style-src 'self';");
    expect(calls.some((c) => c.url === '/v1/intake/public/reviews')).toBe(false);
  });
});
