import { describe, it, expect, vi } from 'vitest';
import { createCorsOriginHandler } from './cors';

function handler(options: { isProduction?: boolean; configuredOrigins?: string[]; customDomains?: string[] } = {}) {
  const prisma = {
    tenant: {
      findMany: vi.fn().mockResolvedValue(
        (options.customDomains ?? []).map((customDomain) => ({ customDomain })),
      ),
    },
  };
  return createCorsOriginHandler(prisma as any, {
    isProduction: options.isProduction ?? true,
    configuredOrigins: options.configuredOrigins ?? [],
  });
}

function allows(origin: string | undefined, options?: Parameters<typeof handler>[0]): Promise<boolean> {
  return new Promise((resolve, reject) => {
    handler(options)(origin, (err, allow) => (err ? reject(err) : resolve(Boolean(allow))));
  });
}

describe('CORS origin handler', () => {
  it('allows the marketing site and the app subdomain', async () => {
    await expect(allows('https://unclutterdesk.com')).resolves.toBe(true);
    await expect(allows('https://www.unclutterdesk.com')).resolves.toBe(true);
    await expect(allows('https://app.unclutterdesk.com')).resolves.toBe(true);
  });

  it('allows tenant booking subdomains', async () => {
    await expect(allows('https://dr-smith.unclutterdesk.com')).resolves.toBe(true);
  });

  it('allows explicitly configured origins', async () => {
    await expect(
      allows('https://ops.example.com', { configuredOrigins: ['https://ops.example.com'] }),
    ).resolves.toBe(true);
  });

  it('allows a verified custom domain and rejects an unverified one', async () => {
    await expect(
      allows('https://booking.drjane.com', { customDomains: ['booking.drjane.com'] }),
    ).resolves.toBe(true);
    await expect(allows('https://booking.drjane.com', { customDomains: [] })).resolves.toBe(false);
  });

  it('allows requests with no Origin (webhooks, health checks, same-origin)', async () => {
    await expect(allows(undefined)).resolves.toBe(true);
  });

  // Regression: the previous implementation used endsWith/includes substring
  // checks, so every one of these was allowed with credentials in production.
  describe('rejects origins that defeated the old substring checks', () => {
    const attacks = [
      'https://attacker.pages.dev',
      'https://anything.some-project.pages.dev',
      'https://localhost.attacker.com',
      'http://localhost.evil.example.com',
      'https://unclutterdesk.com.attacker.com',
      'https://attacker.com/x.unclutterdesk.com',
      'https://evil-unclutterdesk.com',
      'https://a.b.unclutterdesk.com.evil.io',
      'http://app.unclutterdesk.com',
    ];

    for (const origin of attacks) {
      it(`rejects ${origin}`, async () => {
        await expect(allows(origin)).resolves.toBe(false);
      });
    }
  });

  it('still allows localhost and Pages previews outside production', async () => {
    await expect(allows('http://localhost:5173', { isProduction: false })).resolves.toBe(true);
    await expect(allows('http://dr-smith.localhost:5173', { isProduction: false })).resolves.toBe(true);
    await expect(
      allows('https://preview.unclutterdesk-app.pages.dev', { isProduction: false }),
    ).resolves.toBe(true);
  });

  it('never rejects by raising an error, so a bad origin is not a 500', async () => {
    const callback = vi.fn();
    handler()('https://attacker.com', callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());
    expect(callback.mock.calls[0][0]).toBeNull();
    expect(callback.mock.calls[0][1]).toBe(false);
  });

  it('caches custom domain lookups instead of querying on every preflight', async () => {
    const prisma = {
      tenant: { findMany: vi.fn().mockResolvedValue([{ customDomain: 'booking.drjane.com' }]) },
    };
    const origin = createCorsOriginHandler(prisma as any, {
      isProduction: true,
      configuredOrigins: [],
    });

    const ask = () =>
      new Promise((resolve) => origin('https://booking.drjane.com', (_e, allow) => resolve(allow)));

    await expect(ask()).resolves.toBe(true);
    await expect(ask()).resolves.toBe(true);
    await expect(ask()).resolves.toBe(true);

    expect(prisma.tenant.findMany).toHaveBeenCalledTimes(1);
  });
});
