import { describe, expect, it, vi } from 'vitest';
import { profilesConfig } from '../config';
import { DETAILS_MAX, parseReportForm, sendReport, withinRateLimit } from '../report';

const config = profilesConfig({ API_URL: 'https://api.example.test' });

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(entries)) data.set(k, v);
  return data;
};

describe('report form', () => {
  it('accepts a known reason with optional details, normalising line endings', () => {
    expect(parseReportForm(form({ type: 'UNSAFE', details: '  line one\r\nline two  ' }))).toEqual({
      ok: true,
      form: { type: 'UNSAFE', details: 'line one\nline two', website: '' },
    });
  });

  it('refuses a missing or unknown reason, and over-long details', () => {
    expect(parseReportForm(form({})).ok).toBe(false);
    expect(parseReportForm(form({ type: 'REMOVAL_REQUEST' })).ok).toBe(false);
    expect(parseReportForm(form({ type: 'OTHER', details: 'x'.repeat(DETAILS_MAX + 1) })).ok).toBe(false);
  });
});

describe('sending a report', () => {
  it('posts JSON to the API with no credentials and treats 202 as sent', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    await expect(sendReport(config, 'folake', { type: 'OTHER', details: 'd', website: '' }, fetchImpl)).resolves.toBe('sent');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.example.test/v1/profiles/folake/report');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBeUndefined();
    expect(Object.keys(init.headers)).not.toContain('cookie');
    expect(JSON.parse(init.body)).toEqual({ type: 'OTHER', details: 'd' });
  });

  it('passes the honeypot through, so the API can drop it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    await sendReport(config, 'folake', { type: 'OTHER', details: '', website: 'spam' }, fetchImpl);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ type: 'OTHER', website: 'spam' });
  });

  it('maps API answers and network failures to outcomes', async () => {
    const answer = (status: number) => vi.fn().mockResolvedValue(new Response(null, { status }));
    const f = { type: 'OTHER' as const, details: '', website: '' };
    await expect(sendReport(config, 'folake', f, answer(404))).resolves.toBe('missing');
    await expect(sendReport(config, 'folake', f, answer(429))).resolves.toBe('limited');
    await expect(sendReport(config, 'folake', f, answer(400))).resolves.toBe('invalid');
    await expect(sendReport(config, 'folake', f, answer(500))).resolves.toBe('error');
    await expect(sendReport(config, 'folake', f, answer(302))).resolves.toBe('error');
    await expect(sendReport(config, 'folake', f, vi.fn().mockRejectedValue(new Error('down')))).resolves.toBe('error');
  });
});

describe('edge rate limit', () => {
  it('keys the limit on the visitor IP, and lets the API decide when there is no limiter', async () => {
    const limiter = { limit: vi.fn().mockResolvedValue({ success: false }) };
    await expect(withinRateLimit(limiter, '203.0.113.9')).resolves.toBe(false);
    expect(limiter.limit).toHaveBeenCalledWith({ key: 'report:203.0.113.9' });
    await expect(withinRateLimit(undefined, '203.0.113.9')).resolves.toBe(true);
    await expect(withinRateLimit(limiter, null)).resolves.toBe(true);
  });
});
