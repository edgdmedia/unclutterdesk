import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import { DailyProvider } from './daily.provider';
import { JaasProvider } from './jaas.provider';
import { LinkProvider } from './link.provider';

const window = { opensAt: new Date('2026-10-06T09:45:00Z'), closesAt: new Date('2026-10-06T11:50:00Z') };
const therapist = { profileId: 7n, name: 'Sarah Smith', owner: true };

describe('Daily', () => {
  beforeEach(() => { process.env.DAILY_API_KEY = 'dk'; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.DAILY_API_KEY; });

  it('is unavailable without a key', () => {
    delete process.env.DAILY_API_KEY;
    expect(new DailyProvider().available()).toBe(false);
  });

  it('creates a private room that closes with the window', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ name: 'ud-900-x', url: 'https://ud.daily.co/ud-900-x' }) });
    vi.stubGlobal('fetch', fetchMock);
    const name = await new DailyProvider().createRoom(900n, window);
    expect(name).toBe('ud-900-x');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.daily.co/v1/rooms');
    expect(body.privacy).toBe('private');
    expect(body.properties.exp).toBe(Math.floor(window.closesAt.getTime() / 1000));
    expect(body.name).toMatch(/^ud-900-[a-f0-9]{16}$/);
  });

  it('gives each person a token for that room, owner only for the therapist', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ domain_name: 'ud' }) });
    vi.stubGlobal('fetch', fetchMock);
    const creds = await new DailyProvider().credentials('ud-900-x', therapist, window);
    expect(creds).toEqual({ provider: 'DAILY', roomUrl: 'https://ud.daily.co/ud-900-x', token: 'tok' });
    const props = JSON.parse(fetchMock.mock.calls[0][1].body).properties;
    expect(props).toMatchObject({ room_name: 'ud-900-x', is_owner: true, user_name: 'Sarah Smith', user_id: '7', exp: Math.floor(window.closesAt.getTime() / 1000) });
  });

  it('throws when Daily refuses, so the router can fall through', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 402, json: async () => ({ error: 'payment-required' }) }));
    await expect(new DailyProvider().createRoom(900n, window)).rejects.toThrow(/Daily/);
  });
});

describe('JaaS', () => {
  it('signs an RS256 token for the room with our key id, moderator only for the therapist', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.JAAS_APP_ID = 'vpaas-magic-cookie-abc';
    process.env.JAAS_KEY_ID = 'vpaas-magic-cookie-abc/k1';
    process.env.JAAS_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const p = new JaasProvider();
    expect(p.available()).toBe(true);
    const room = await p.createRoom(900n, window);
    const creds: any = await p.credentials(room, { profileId: 5n, name: 'Ada Okafor', owner: false }, window);
    expect(creds.provider).toBe('JAAS');
    expect(decodeProtectedHeader(creds.jwt)).toMatchObject({ alg: 'RS256', kid: 'vpaas-magic-cookie-abc/k1' });
    const claims: any = decodeJwt(creds.jwt);
    expect(claims).toMatchObject({ aud: 'jitsi', iss: 'chat', sub: 'vpaas-magic-cookie-abc', room, exp: Math.floor(window.closesAt.getTime() / 1000) });
    expect(claims.context.user).toMatchObject({ name: 'Ada Okafor', id: '5', moderator: 'false' });
  });
});

describe('Link', () => {
  it('always works and points at a long random meet.jit.si room', async () => {
    const p = new LinkProvider();
    const room = await p.createRoom(900n, window);
    expect(room).toMatch(/^unclutterdesk-[a-f0-9]{32}$/);
    expect(await p.credentials(room, therapist, window)).toEqual({ provider: 'LINK', url: `https://meet.jit.si/${room}` });
  });
});
