import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The scrubbing in instrument.ts is the only thing standing between a stack
 * trace and a clinical note leaving the building, so it is tested directly
 * rather than trusted.
 *
 * The module calls Sentry.init at import time, so the SDK is mocked and the
 * options it was given are inspected.
 */
const initMock = vi.fn();
vi.mock('@sentry/nestjs', () => ({ init: (...args: unknown[]) => initMock(...args) }));

async function loadWith(env: Record<string, string | undefined>) {
  vi.resetModules();
  initMock.mockClear();
  const previous = { ...process.env };
  // process.env coerces values to strings, so assigning undefined would set the
  // literal string "undefined" — which is truthy, and would defeat the point.
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const mod = await import('./instrument');
  process.env = previous;
  return { mod, options: initMock.mock.calls[0]?.[0] };
}

describe('Sentry instrumentation', () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.SENTRY_DSN;
    delete process.env.SENTRY_TRACES_SAMPLE_RATE;
  });
  afterEach(() => {
    process.env = { ...original };
    vi.restoreAllMocks();
  });

  it('does nothing at all without a DSN', async () => {
    const { mod } = await loadWith({ SENTRY_DSN: undefined });
    expect(initMock).not.toHaveBeenCalled();
    expect((mod as any).sentryEnabled).toBe(false);
  });

  it('ignores a blank DSN', async () => {
    const { mod } = await loadWith({ SENTRY_DSN: '   ' });
    expect(initMock).not.toHaveBeenCalled();
    expect((mod as any).sentryEnabled).toBe(false);
  });

  it('initialises with PII disabled and tracing off by default', async () => {
    const { options } = await loadWith({ SENTRY_DSN: 'https://k@o.ingest.sentry.io/1' });
    expect(options.sendDefaultPii).toBe(false);
    // Tracing samples real requests and costs money; opt in deliberately.
    expect(options.tracesSampleRate).toBe(0);
  });

  it('honours an explicit trace sample rate', async () => {
    const { options } = await loadWith({
      SENTRY_DSN: 'https://k@o.ingest.sentry.io/1',
      SENTRY_TRACES_SAMPLE_RATE: '0.25',
    });
    expect(options.tracesSampleRate).toBe(0.25);
  });

  describe('beforeSend scrubbing', () => {
    let beforeSend: (event: any) => any;

    beforeEach(async () => {
      const { options } = await loadWith({ SENTRY_DSN: 'https://k@o.ingest.sentry.io/1' });
      beforeSend = options.beforeSend;
    });

    it('drops the request body', () => {
      const event = beforeSend({
        request: { data: { subjective: 'client reports low mood', password: 'hunter2' } },
      });
      expect(event.request.data).toBeUndefined();
      expect(JSON.stringify(event)).not.toContain('low mood');
      expect(JSON.stringify(event)).not.toContain('hunter2');
    });

    it('drops cookies, which carry the session', () => {
      const event = beforeSend({ request: { cookies: { unclutter_access: 'jwt' } } });
      expect(event.request.cookies).toBeUndefined();
    });

    it('strips the query string, which carries reset and verification tokens', () => {
      const event = beforeSend({
        request: {
          url: 'https://api.unclutterdesk.com/v1/auth/reset-password?token=secret-token',
          query_string: 'token=secret-token',
        },
      });
      expect(event.request.url).toBe('https://api.unclutterdesk.com/v1/auth/reset-password');
      expect(event.request.query_string).toBeUndefined();
      expect(JSON.stringify(event)).not.toContain('secret-token');
    });

    it('keeps only allowlisted headers', () => {
      const event = beforeSend({
        request: {
          headers: {
            'content-type': 'application/json',
            'user-agent': 'Mozilla/5.0',
            authorization: 'Bearer secret',
            cookie: 'unclutter_access=jwt',
            'x-csrf-token': 'csrf',
          },
        },
      });
      expect(Object.keys(event.request.headers).sort()).toEqual(['content-type', 'user-agent']);
      expect(JSON.stringify(event)).not.toContain('Bearer secret');
    });

    // Allowlist rather than denylist: a header added next year is dropped by
    // default instead of leaking until somebody notices.
    it('drops an unrecognised header it has never seen before', () => {
      const event = beforeSend({
        request: { headers: { 'x-some-future-header': 'possibly sensitive' } },
      });
      expect(event.request.headers).toEqual({});
    });

    it('leaves an event with no request untouched', () => {
      const event = beforeSend({ message: 'scheduled job failed' });
      expect(event.message).toBe('scheduled job failed');
    });
  });

  describe('beforeBreadcrumb scrubbing', () => {
    let beforeBreadcrumb: (b: any) => any;

    beforeEach(async () => {
      const { options } = await loadWith({ SENTRY_DSN: 'https://k@o.ingest.sentry.io/1' });
      beforeBreadcrumb = options.beforeBreadcrumb;
    });

    it('discards query breadcrumbs, which contain SQL parameters', () => {
      expect(beforeBreadcrumb({ category: 'query', message: 'SELECT * FROM "ClinicalNote"' })).toBeNull();
    });

    it('strips a body from other breadcrumbs', () => {
      const crumb = beforeBreadcrumb({ category: 'http', data: { body: 'phq9 answers', status: 500 } });
      expect(crumb.data.body).toBeUndefined();
      expect(crumb.data.status).toBe(500);
    });

    it('keeps ordinary breadcrumbs', () => {
      const crumb = beforeBreadcrumb({ category: 'console', message: 'started' });
      expect(crumb.message).toBe('started');
    });
  });
});
