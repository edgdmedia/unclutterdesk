import { describe, expect, it, vi } from 'vitest';
import { profilesConfig } from '../config';
import { lookupProfile, personJsonLd, type PublicProfile } from '../profiles';

const config = profilesConfig({ API_URL: 'https://api.example.test' });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('reading a profile from the public API', () => {
  it('sends a fresh request with no visitor headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(200, { profile: { handle: 'ada' } }));
    await lookupProfile(config, 'ada', fetchImpl as never);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.example.test/v1/profiles/ada');
    expect(Object.keys(init.headers)).toEqual(['accept']);
    expect(init.redirect).toBe('manual');
  });

  it.each([
    [404, {}, { kind: 'missing' }],
    [410, {}, { kind: 'gone' }],
    [200, { redirectTo: 'ada-o' }, { kind: 'moved', handle: 'ada-o' }],
    [200, { redirectTo: '../evil' }, { kind: 'missing' }],
  ])('maps %i %j', async (status, body, expected) => {
    expect(await lookupProfile(config, 'ada', vi.fn().mockResolvedValue(json(status, body)) as never)).toEqual(expected);
  });

  it('treats an API redirect or error as a failure, not a page', async () => {
    await expect(lookupProfile(config, 'ada', vi.fn().mockResolvedValue(new Response(null, { status: 302 })) as never)).rejects.toThrow();
    await expect(lookupProfile(config, 'ada', vi.fn().mockResolvedValue(json(500, {})) as never)).rejects.toThrow();
  });

  it('never asks the API about a malformed handle', async () => {
    const fetchImpl = vi.fn();
    expect(await lookupProfile(config, '../admin', fetchImpl as never)).toEqual({ kind: 'missing' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('JSON-LD Person (§6.11)', () => {
  it('names the person, their role, languages and place, with no ratings', () => {
    const ld = personJsonLd(
      { displayName: 'Ada', kind: 'PSYCHOLOGIST', headline: 'Calm', photoUrl: null, languages: [{ key: 'yoruba', label: 'Yoruba' }], countryCode: 'NG', city: 'Lagos' } as unknown as PublicProfile,
      'https://p.test/ada',
    );
    expect(ld).toMatchObject({ '@type': 'Person', name: 'Ada', jobTitle: 'Psychologist', knowsLanguage: ['Yoruba'], address: { addressCountry: 'NG', addressLocality: 'Lagos' } });
    expect(JSON.stringify(ld)).not.toMatch(/rating|review/i);
  });
});
