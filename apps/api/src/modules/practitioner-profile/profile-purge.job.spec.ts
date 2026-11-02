import { afterEach, describe, expect, it, vi } from 'vitest';
import { JobDeferredError } from '../jobs/jobs.service';
import { ProfilePurgeJob } from './profile-purge.job';
import { PROFILE_PUBLIC_ORIGIN } from '../../common/origins';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const job = () => new ProfilePurgeJob({ register: vi.fn() } as any);

describe('profile purge job (§6.12)', () => {
  it("calls the profile site's purge endpoint with the shared secret and the tags", async () => {
    vi.stubEnv('PROFILES_PURGE_SECRET', 'purge-secret');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"success":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await job().run({ tags: ['profile:ada', 'sitemap'] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${PROFILE_PUBLIC_ORIGIN}/api/purge`);
    expect(init.method).toBe('POST');
    expect(init.headers['x-purge-secret']).toBe('purge-secret');
    expect(JSON.parse(init.body)).toEqual({ tags: ['profile:ada', 'sitemap'] });
  });

  it('fails loudly on an error answer, so the runner retries it', async () => {
    vi.stubEnv('PROFILES_PURGE_SECRET', 'purge-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 502 })));
    await expect(job().run({ tags: ['profile:ada'] })).rejects.toThrow(/502/);
  });

  it('waits while the site has no purge secret', async () => {
    vi.stubEnv('PROFILES_PURGE_SECRET', '');
    await expect(job().run({ tags: ['profile:ada'] })).rejects.toBeInstanceOf(JobDeferredError);
  });
});
