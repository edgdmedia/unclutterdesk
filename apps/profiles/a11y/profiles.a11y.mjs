import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { HANDLES } from './fixtures.mjs';

/**
 * WCAG 2.1 A/AA on every page the profiles site serves, in every layout and
 * palette (spec §6.5). Serious and critical violations fail the run; minor and
 * moderate ones are reported but do not, so the gate stays about real barriers.
 */
const URLS = ['/', '/pricing', ...HANDLES.map((h) => `/${h}`)];
const BLOCKING = new Set(['serious', 'critical']);

for (const path of URLS) {
  test(`no serious or critical accessibility violations on ${path}`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: 'load' });
    expect(response?.status(), `${path} should render`).toBe(200);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blocking = results.violations.filter((v) => BLOCKING.has(v.impact ?? ''));
    for (const v of results.violations) {
      console.log(`[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s)) — ${v.helpUrl}`);
    }
    expect(
      blocking.map((v) => `${v.id} (${v.impact}): ${v.help}`),
      `serious/critical violations on ${path}`,
    ).toEqual([]);
  });
}