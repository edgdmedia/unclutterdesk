import { expect, test, type Page } from '@playwright/test';

/**
 * A client signs in and books on a practice's custom domain, with the API
 * served first-party at {host}/api by the tenant router (spec §6.16).
 *
 * Before the proxy, sign-in "succeeded" and then signed the client straight
 * out, and booking failed with "session expired": the API's cookies were
 * third-party on the custom domain and the CSRF cookie unreadable.
 */
const EMAIL = 'e2e.client@example.com';
const PASSWORD = 'E2e-Client-Pass1!';
const SERVICE = 'E2E free consultation';

/** fetch from the page, as the app does: same origin, cookies included. */
async function call(page: Page, method: string, path: string, opts: { body?: unknown; csrf?: boolean } = {}) {
  return page.evaluate(
    async ({ method, path, body, csrf }) => {
      const token = document.cookie
        .split('; ')
        .find((c) => c.startsWith('unclutter_csrf='))
        ?.slice('unclutter_csrf='.length);
      const res = await fetch(path, {
        method,
        credentials: 'include',
        headers: { 'content-type': 'application/json', ...(csrf && token ? { 'x-csrf-token': decodeURIComponent(token) } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, body: await res.text() };
    },
    { method, path, body: opts.body, csrf: opts.csrf ?? true },
  );
}

test('a client signs in and books through the custom-domain proxy, with CSRF', async ({ page, context, baseURL }) => {
  const host = new URL(baseURL!).hostname;

  // ── Sign in through the app's own form ────────────────────────────────
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in and continue' }).click();
  await expect(page).toHaveURL(/\/portal$/);

  // The cookies belong to the custom domain: host-only, the refresh cookie
  // under /api, and the CSRF cookie readable by the page.
  const cookies = await context.cookies();
  const named = (n: string) => cookies.find((c) => c.name === n);
  for (const name of ['unclutter_access', 'unclutter_refresh', 'unclutter_csrf']) {
    expect(named(name), `${name} was not stored for ${host}`).toBeDefined();
    expect(named(name)!.domain).toBe(host);
  }
  expect(named('unclutter_refresh')!.path).toBe('/api/v1/auth/refresh');
  expect(await page.evaluate(() => document.cookie)).toContain('unclutter_csrf=');

  // ── Still signed in after a moment and after a reload (the old bug) ──
  await page.waitForTimeout(2000);
  await page.reload();
  await expect(page).toHaveURL(/\/portal$/);
  const status = await call(page, 'GET', '/api/v1/auth/status');
  expect(status.status).toBe(200);

  // ── The refresh cookie reaches /api/v1/auth/refresh ─────────────────
  const refreshed = await call(page, 'POST', '/api/v1/auth/refresh');
  expect(refreshed.status, refreshed.body).toBeLessThan(300);

  // ── Book a session: a write, so CSRF is enforced through the proxy ───
  const services = JSON.parse((await call(page, 'GET', '/api/v1/consult/public/services')).body) as Array<{ id: string; title: string }>;
  const service = services.find((s) => s.title === SERVICE);
  expect(service, 'the e2e service is listed').toBeDefined();
  const slots = JSON.parse((await call(page, 'GET', '/api/v1/consult/public/availability')).body) as Array<{ id: string; serviceId: string | null }>;
  const slot = slots.find((s) => s.serviceId === service!.id || s.serviceId === null);
  expect(slot, 'an open slot is listed').toBeDefined();
  const booking = { serviceId: service!.id, availabilityId: slot!.id, format: 'ONLINE' };

  const withoutCsrf = await call(page, 'POST', '/api/v1/consult/public/bookings', { body: booking, csrf: false });
  expect(withoutCsrf.status).toBe(403);

  const booked = await call(page, 'POST', '/api/v1/consult/public/bookings', { body: booking });
  expect(booked.status, booked.body).toBe(201);
  expect(JSON.parse(booked.body)).toMatchObject({ status: 'CONFIRMED' });

  // ── Admin and dashboard routes are refused through the proxy ────────
  for (const path of ['/api/v1/admin/tenants', '/api/v1/tenant/brand', '/api/v1/consult/practice/sessions']) {
    const refused = await call(page, 'GET', path);
    expect(refused.status, path).toBe(404);
  }

  // ── Opening an /api address reaches the API, not the app ────────────
  const opened = await page.goto('/api/v1/tenant/brand');
  expect(opened?.status()).toBe(404);
  expect(await opened?.headerValue('content-type')).toContain('application/json');

  // ── Signing out really clears the cookies, refresh cookie included ──
  await page.goto('/portal');
  const out = await call(page, 'POST', '/api/v1/auth/logout');
  expect(out.status).toBeLessThan(300);
  const left = (await context.cookies()).map((c) => c.name);
  expect(left).not.toContain('unclutter_access');
  expect(left).not.toContain('unclutter_refresh');
});
