import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { createCorsOptionsDelegate } from './cors';
import { PROFILE_PUBLIC_ORIGIN, isAllowedRedirectTarget, isPlatformOrigin } from './origins';
import { CsrfGuard } from '../modules/auth/csrf.guard';
import { ACCESS_COOKIE, CSRF_COOKIE } from './auth.config';

/*
 * Spec §4.3: the public-profile site shows text therapists write, so it is
 * never trusted like the platform, even while it sits under the platform's
 * domain (profiles.<root>, which matches the practice-subdomain pattern).
 */
const PROFILES = PROFILE_PUBLIC_ORIGIN;
const prisma: any = { tenant: { findMany: vi.fn().mockResolvedValue([]) } };
const delegate = createCorsOptionsDelegate(prisma, { isProduction: true, configuredOrigins: [] });

function corsFor(origin: string, path: string): Promise<any> {
  return new Promise((resolve, reject) => delegate({ headers: { origin }, path }, (err, options) => (err ? reject(err) : resolve(options))));
}
function originAllowed(options: any, origin: string): Promise<boolean> {
  if (typeof options.origin !== 'function') return Promise.resolve(Boolean(options.origin));
  return new Promise((resolve) => options.origin(origin, (_e: unknown, allow: boolean) => resolve(Boolean(allow))));
}

describe('the public-profile site is untrusted (§4.3)', () => {
  it('gets no CORS at all on authenticated or other routes', async () => {
    for (const path of ['/v1/auth/status', '/v1/practitioner-profile/me', '/v1/profiles/adaeze']) {
      const options = await corsFor(PROFILES, path);
      expect(await originAllowed(options, PROFILES), path).toBe(false);
    }
  });

  it('may call its two public routes, without credentials', async () => {
    for (const path of ['/v1/profiles/adaeze/report', '/v1/profiles/adaeze/event']) {
      const options = await corsFor(PROFILES, path);
      expect(options.origin).toBe(true);
      expect(options.credentials).toBe(false);
    }
  });

  it('keeps credentialed CORS for the platform itself', async () => {
    const options = await corsFor('https://app.unclutterdesk.com', '/v1/auth/status');
    expect(options.credentials).toBe(true);
    expect(await originAllowed(options, 'https://app.unclutterdesk.com')).toBe(true);
    expect(await originAllowed(options, PROFILES)).toBe(false);
  });

  it('is never a platform origin or a redirect target, though it matches the subdomain pattern', () => {
    expect(isPlatformOrigin(PROFILES, true)).toBe(false);
    expect(isAllowedRedirectTarget(`${PROFILES}/x`, { isProduction: true })).toBe(false);
    expect(isPlatformOrigin('https://dr-smith.unclutterdesk.com', true)).toBe(true);
  });

  it('cannot act on a session, even with a matching CSRF token', () => {
    const guard = new CsrfGuard();
    const token = 'a'.repeat(64);
    const ctx = (origin?: string, cookies: Record<string, string> = { [ACCESS_COOKIE]: 'x', [CSRF_COOKIE]: token }) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ method: 'POST', path: '/v1/practitioner-profile/me/publish', cookies, headers: { 'x-csrf-token': token, ...(origin ? { origin } : {}) } }),
        }),
      }) as any;
    expect(() => guard.canActivate(ctx(PROFILES))).toThrow(ForbiddenException);
    expect(guard.canActivate(ctx('https://app.unclutterdesk.com'))).toBe(true);
    // A public, cookie-free call from the profiles site (the report form) is fine.
    expect(guard.canActivate(ctx(PROFILES, {}))).toBe(true);
  });
});
