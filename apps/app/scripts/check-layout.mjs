// Loads practice routes at phone, tablet, laptop and desktop widths and fails
// when a page scrolls sideways or the sidebar is the wrong kind for the width.
// Needs the API and app running locally with seed data:
//   API: cd apps/api && PORT=3099 node dist/src/main.js
//   App: cd apps/app && VITE_API_URL=http://localhost:3099 npx vite --port 5173 --strictPort
// Browser: set CHROME_PATH, or run `npx playwright install chromium` once.
import { chromium } from 'playwright-core';

const BASE = process.env.APP_URL ?? 'http://localhost:5173';
const EMAIL = process.env.LAYOUT_EMAIL ?? 'dr.jane@smiththerapy.ng';
const PASSWORD = process.env.LAYOUT_PASSWORD ?? 'password123';
const WIDTHS = [390, 820, 1024, 1280];

// Routes that must pass. PRs 2–5 move routes from REPORT to STRICT.
const STRICT = [
  '/dashboard', '/dashboard/analytics', 'CLIENT',
  '/dashboard/clients', '/dashboard/hours', '/dashboard/settings/team', '/dashboard/settings/discounts',
  '/dashboard/sessions',
];
const REPORT = [
  '/dashboard/schedule', '/dashboard/submissions', '/dashboard/notifications', '/dashboard/profile',
  '/dashboard/settings/account', '/dashboard/settings/availability',
];

// The admin console shares the shell now (ADM-02); checked in a second pass,
// signed in as an operator rather than practice staff.
const ADMIN_REPORT = ['/admin', '/admin/invites'];
const ADMIN_EMAIL = process.env.LAYOUT_ADMIN_EMAIL ?? 'admin@unclutterdesk.com';
const ADMIN_PASSWORD = process.env.LAYOUT_ADMIN_PASSWORD ?? 'password123';

const expectedSidebar = (w) => (w < 768 ? 'none' : w < 1280 ? 'rail' : 'full');

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await page.goto(`${BASE}/login`);
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(/dashboard/, { timeout: 20000 });

// "CLIENT" stands for the first client's page, whatever its id.
await page.goto(`${BASE}/dashboard/clients`);
await page.waitForTimeout(1500);
const clientHref = await page.locator('a[href^="/dashboard/clients/"]').first().getAttribute('href').catch(() => null);
const resolve = (r) => (r === 'CLIENT' ? clientHref : r);

let failures = 0;
for (const [routes, strict] of [[STRICT, true], [REPORT, false]]) {
  for (const raw of routes) {
    const route = resolve(raw);
    if (!route) {
      console.log(`skip ${raw}: no client to open`);
      continue;
    }
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(BASE + route);
      await page.waitForTimeout(1200);
      const r = await page.evaluate(() => {
        const doc = document.documentElement;
        const aside = document.querySelector('aside:not([role="dialog"])');
        const width = aside ? Math.round(aside.getBoundingClientRect().width) : 0;
        const wide = [...document.querySelectorAll('body *')]
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return b.width > 0 && b.right > doc.clientWidth + 1 && getComputedStyle(el).position !== 'fixed';
          })
          .slice(-3)
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}`);
        return { overflow: doc.scrollWidth - doc.clientWidth, sidebar: !aside ? 'none' : width <= 80 ? 'rail' : 'full', wide };
      });
      const problems = [];
      if (r.overflow > 0) problems.push(`scrolls sideways by ${r.overflow}px (${r.wide.join(', ')})`);
      if (r.sidebar !== expectedSidebar(w)) problems.push(`sidebar is ${r.sidebar}, expected ${expectedSidebar(w)}`);
      const label = `${strict ? 'STRICT' : 'report'} ${w}px ${route}`;
      if (problems.length) {
        console.log(`${strict ? '✗' : '·'} ${label}: ${problems.join('; ')}`);
        if (strict) failures++;
      } else {
        console.log(`✓ ${label}`);
      }
    }
  }
}
// The public booking wizard, on a practice's own host. No sign-in, and no
// app sidebar (its summary card is an <aside>), so only sideways scroll counts.
const BOOKING = process.env.BOOKING_URL ?? 'http://dr-smith.localhost:5173';
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto(`${BOOKING}/book`);
  await page.waitForTimeout(1500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const label = `STRICT ${w}px ${BOOKING}/book`;
  if (overflow > 0) {
    console.log(`✗ ${label}: scrolls sideways by ${overflow}px`);
    failures++;
  } else {
    console.log(`✓ ${label}`);
  }
}
for (const route of ADMIN_REPORT) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const adminPage = await ctx.newPage();
  await adminPage.goto(`${BASE}/admin/login`);
  await adminPage.fill('input[type="email"]', ADMIN_EMAIL);
  await adminPage.fill('input[type="password"]', ADMIN_PASSWORD);
  await adminPage.click('button[type="submit"]');
  // /admin/login also matches /\/admin/, so wait for the real landing instead.
  await adminPage.waitForURL((u) => /\/admin(?!\/login)/.test(u.pathname), { timeout: 20000 });
  for (const w of WIDTHS) {
    await adminPage.setViewportSize({ width: w, height: 900 });
    await adminPage.goto(BASE + route);
    await adminPage.waitForTimeout(1200);
    const r = await adminPage.evaluate(() => {
      const doc = document.documentElement;
      const aside = document.querySelector('aside:not([role="dialog"])');
      const width = aside ? Math.round(aside.getBoundingClientRect().width) : 0;
      return { overflow: doc.scrollWidth - doc.clientWidth, sidebar: !aside ? 'none' : width <= 80 ? 'rail' : 'full' };
    });
    const problems = [];
    if (r.overflow > 0) problems.push(`scrolls sideways by ${r.overflow}px`);
    if (r.sidebar !== expectedSidebar(w)) problems.push(`sidebar is ${r.sidebar}, expected ${expectedSidebar(w)}`);
    console.log(problems.length ? `· report ${w}px ${route}: ${problems.join('; ')}` : `✓ report ${w}px ${route}`);
  }
  await ctx.close();
}
await browser.close();
if (failures) {
  console.error(`\n${failures} strict check(s) failed.`);
  process.exit(1);
}
console.log('\nAll strict routes fit at every width.');
