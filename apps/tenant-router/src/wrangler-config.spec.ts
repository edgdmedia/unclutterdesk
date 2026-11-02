import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * `wrangler deploy` replaces the Worker's routes with the ones in
 * wrangler.jsonc. Listing any there deletes the custom-domain routes the API
 * creates for practices, and every custom domain then answers 522. The API's
 * custom-domain cron owns all routes instead.
 */
const config = readFileSync(resolve(__dirname, '../wrangler.jsonc'), 'utf8')
  .split('\n')
  .map((line) => line.replace(/^\s*\/\/.*$/, ''))
  .join('\n');

describe('wrangler.jsonc', () => {
  it('declares no routes, so a deploy never removes a practice domain route', () => {
    expect(config).not.toMatch(/"routes?"\s*:/);
  });

  it('keeps workers.dev off, which Wrangler would otherwise enable without routes', () => {
    expect(config).toMatch(/"workers_dev"\s*:\s*false/);
  });
});
