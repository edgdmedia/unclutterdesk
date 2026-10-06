import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudflareSaasService } from './cloudflare-saas.service';

const fetchMock = vi.fn();

function ok(result: unknown) {
  return { json: async () => ({ success: true, errors: [], result }) };
}

function fail(errors: Array<{ code: number; message: string }>, status = 400) {
  return { status, json: async () => ({ success: false, errors, result: null }) };
}

describe('CloudflareSaasService', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {
      CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
      CLOUDFLARE_AUTH_EMAIL: process.env.CLOUDFLARE_AUTH_EMAIL,
      CLOUDFLARE_API_KEY: process.env.CLOUDFLARE_API_KEY,
      CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID,
      CLOUDFLARE_WORKER_SCRIPT: process.env.CLOUDFLARE_WORKER_SCRIPT,
    };
    process.env.CLOUDFLARE_API_TOKEN = 'tok';
    process.env.CLOUDFLARE_ZONE_ID = 'zone123';
    process.env.CLOUDFLARE_WORKER_SCRIPT = 'unclutterdesk-tenant-router';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [k, v] of Object.entries(saved)) (v === undefined ? delete process.env[k] : (process.env[k] = v));
  });

  it('is unconfigured without a token or zone, and the service then never calls out', () => {
    delete process.env.CLOUDFLARE_ZONE_ID;
    const service = new CloudflareSaasService();
    expect(service.configured()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the legacy Global API key headers when configured — custom hostnames reject tokens', async () => {
    delete process.env.CLOUDFLARE_API_TOKEN;
    process.env.CLOUDFLARE_AUTH_EMAIL = 'me@example.com';
    process.env.CLOUDFLARE_API_KEY = 'legacykey';
    fetchMock.mockResolvedValue(ok({ id: 'cf-id-9', status: 'pending', ssl: { status: 'pending' } }));
    const service = new CloudflareSaasService();
    expect(service.configured()).toBe(true);
    await service.getStatus('cf-id-9');
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['X-Auth-Email']).toBe('me@example.com');
    expect(headers['X-Auth-Key']).toBe('legacykey');
    expect(headers.Authorization).toBeUndefined();
    delete process.env.CLOUDFLARE_AUTH_EMAIL;
    delete process.env.CLOUDFLARE_API_KEY;
  });

  it('creates the hostname with CNAME validation and maps the verification records', async () => {
    fetchMock.mockResolvedValue(ok({
      id: 'cf-id-1',
      status: 'pending',
      cname_target: 'zone-tag.my.cloudflare.net',
      ssl: {
        status: 'pending',
        verification_records: [{ name: '_cf-chl.generated.zone.', type: 'CNAME', data: 'x', target: 'y' }],
      },
    }));
    const service = new CloudflareSaasService();
    const result = await service.createHostname('booking.acme.ng', '42');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/zones/zone123/custom_hostnames',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ hostname: 'booking.acme.ng', ssl: { method: 'txt', type: 'dv' }, custom_metadata: { tenant: '42' } });
    expect(result).toMatchObject({ id: 'cf-id-1', status: 'pending', sslStatus: 'pending', cnameTarget: 'zone-tag.my.cloudflare.net' });
    expect(result.verificationRecords).toHaveLength(1);
  });

  it('reads status back for the poller', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'cf-id-1', status: 'active', ssl: { status: 'active' } }));
    const service = new CloudflareSaasService();
    await expect(service.getStatus('cf-id-1')).resolves.toEqual({ status: 'active', sslStatus: 'active' });
    expect(fetchMock.mock.calls[0][0]).toContain('/custom_hostnames/cf-id-1');
  });

  it('treats an already-deleted hostname as success', async () => {
    fetchMock.mockResolvedValue(fail([{ code: 1009, message: 'could not find content' }]));
    const service = new CloudflareSaasService();
    await expect(service.deleteHostname('gone')).resolves.toBeUndefined();
  });

  it('surfaces other Cloudflare errors', async () => {
    fetchMock.mockResolvedValue(fail([{ code: 12021, message: 'quota reached' }]));
    const service = new CloudflareSaasService();
    await expect(service.getStatus('x')).rejects.toThrow(/12021: quota reached/);
  });

  it('ensureRoute skips a pattern that already exists', async () => {
    fetchMock
      .mockResolvedValueOnce(ok([{ id: 'r1', pattern: 'booking.acme.ng/*', script: 'unclutterdesk-tenant-router' }]))
      .mockResolvedValueOnce(ok({}));
    const service = new CloudflareSaasService();
    await service.ensureRoute('booking.acme.ng');
    expect(fetchMock).toHaveBeenCalledTimes(1); // the GET list; no POST
  });

  it('ensureRoute creates the route pointed at the tenant router', async () => {
    fetchMock
      .mockResolvedValueOnce(ok([{ id: 'r1', pattern: 'other.com/*' }]))
      .mockResolvedValueOnce(ok({ id: 'r2' }));
    const service = new CloudflareSaasService();
    await service.ensureRoute('booking.acme.ng');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const post = fetchMock.mock.calls[1];
    expect(post[1].method).toBe('POST');
    expect(JSON.parse(post[1].body)).toEqual({ pattern: 'booking.acme.ng/*', script: 'unclutterdesk-tenant-router' });
  });

  it('removeRoute deletes by matching pattern and tolerates absence', async () => {
    fetchMock
      .mockResolvedValueOnce(ok([{ id: 'r9', pattern: 'booking.acme.ng/*' }]))
      .mockResolvedValueOnce(ok({}));
    const service = new CloudflareSaasService();
    await service.removeRoute('booking.acme.ng');
    expect(fetchMock.mock.calls[1][0]).toContain('/workers/routes/r9');

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(ok([]));
    await service.removeRoute('nothing.here.ng');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
