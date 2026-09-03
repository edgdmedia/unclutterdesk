import { describe, it, expect, afterEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';
import { ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE } from '../../common/auth.config';

const TOKEN = 'a'.repeat(64);

function ctx({
  method = 'POST',
  path = '/v1/notes',
  cookies = {} as Record<string, string>,
  headers = {} as Record<string, unknown>,
}) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, path, cookies, headers }) }),
  } as any;
}

const session = { [ACCESS_COOKIE]: 'access', [CSRF_COOKIE]: TOKEN };

describe('CsrfGuard', () => {
  const guard = new CsrfGuard();
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows safe methods', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(guard.canActivate(ctx({ method, cookies: session }))).toBe(true);
    }
  });

  it('allows a matching double-submit token', () => {
    expect(
      guard.canActivate(ctx({ cookies: session, headers: { 'x-csrf-token': TOKEN } })),
    ).toBe(true);
  });

  it('rejects a mismatched token', () => {
    expect(() =>
      guard.canActivate(ctx({ cookies: session, headers: { 'x-csrf-token': 'b'.repeat(64) } })),
    ).toThrow(ForbiddenException);
  });

  it('rejects a missing header', () => {
    expect(() => guard.canActivate(ctx({ cookies: session }))).toThrow(ForbiddenException);
  });

  it('rejects when the cookie is absent but a session exists', () => {
    expect(() =>
      guard.canActivate(
        ctx({ cookies: { [ACCESS_COOKIE]: 'access' }, headers: { 'x-csrf-token': TOKEN } }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects a repeated header sent as an array', () => {
    expect(() =>
      guard.canActivate(ctx({ cookies: session, headers: { 'x-csrf-token': [TOKEN, TOKEN] } })),
    ).toThrow(ForbiddenException);
  });

  it('rejects empty-string tokens on both sides', () => {
    expect(() =>
      guard.canActivate(
        ctx({
          cookies: { [ACCESS_COOKIE]: 'access', [CSRF_COOKIE]: '' },
          headers: { 'x-csrf-token': '' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows unauthenticated calls, which have nothing to forge', () => {
    // Public booking and provider webhooks arrive with no session cookie.
    expect(guard.canActivate(ctx({ path: '/v1/consult/public/bookings' }))).toBe(true);
    expect(guard.canActivate(ctx({ path: '/v1/stripe/webhook' }))).toBe(true);
  });

  describe('exempt routes', () => {
    const exempt = [
      '/v1/auth/login',
      '/v1/auth/register',
      '/v1/auth/verify-email',
      '/v1/auth/resend-verification',
      '/v1/auth/forgot-password',
      '/v1/auth/reset-password',
      '/v1/auth/refresh',
      '/v1/admin/auth/login',
      '/v1/tenant/register',
    ];

    for (const path of exempt) {
      it(`exempts POST ${path}`, () => {
        expect(guard.canActivate(ctx({ path, cookies: session }))).toBe(true);
      });
    }

    it('exempts only the listed method', () => {
      // The exemption is method-scoped, so a DELETE to the same path is not free.
      expect(() =>
        guard.canActivate(ctx({ method: 'DELETE', path: '/v1/auth/login', cookies: session })),
      ).toThrow(ForbiddenException);
    });

    it('ignores a trailing slash and a query string', () => {
      expect(guard.canActivate(ctx({ path: '/v1/auth/login/', cookies: session }))).toBe(true);
      expect(guard.canActivate(ctx({ path: '/v1/auth/login?next=/x', cookies: session }))).toBe(true);
    });

    it('does not exempt logout, which the client sends a token on', () => {
      expect(() => guard.canActivate(ctx({ path: '/v1/auth/logout', cookies: session }))).toThrow(
        ForbiddenException,
      );
    });
  });

  // Regression: the previous guard matched on `path.includes(...)`, so any
  // route whose path merely contained one of these fragments was exempt.
  describe('routes the old substring matching wrongly exempted', () => {
    const shouldBeProtected = [
      '/v1/tenant/staff/invite', // matched '/invite' — adds staff to a practice
      '/v1/tenant/brand/custom-domain/verify',
      '/v1/privacy/clients/12/erase',
      '/v1/notes',
      '/v1/discount',
    ];

    for (const path of shouldBeProtected) {
      it(`protects POST ${path}`, () => {
        expect(() => guard.canActivate(ctx({ path, cookies: session }))).toThrow(ForbiddenException);
      });
    }

    it('does not exempt a path that merely ends with an exempt route', () => {
      expect(() =>
        guard.canActivate(ctx({ path: '/v1/evil/v1/auth/login', cookies: session })),
      ).toThrow(ForbiddenException);
    });
  });

  describe('DISABLE_CSRF escape hatch', () => {
    it('is ignored in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DISABLE_CSRF = 'true';
      expect(() => guard.canActivate(ctx({ cookies: session }))).toThrow(ForbiddenException);
    });

    it('still works outside production', () => {
      process.env.NODE_ENV = 'development';
      process.env.DISABLE_CSRF = 'true';
      expect(guard.canActivate(ctx({ cookies: session }))).toBe(true);
    });
  });
});
