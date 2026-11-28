import { describe, expect, it } from 'vitest';
import worker, { type Env } from '../worker';

const fetcher = (name: string) => ({ fetch: async () => new Response(name) });
const env: Env = { ASSETS: fetcher('app'), DESK_SITE: fetcher('desk'), APP_HOST: 'therapysts.app' };
const served = async (url: string) => (await worker.fetch(new Request(url), env)).text();

describe('app worker', () => {
  it('serves the Desk home on the app host', async () => {
    expect(await served('https://therapysts.app/')).toBe('desk');
    expect(await served('https://therapysts.app/pricing')).toBe('desk');
  });

  it('keeps a practice page (fetched through workers.dev) as the app', async () => {
    expect(await served('https://therapysts-app.therapysts.workers.dev/')).toBe('app');
  });
});
