import { describe, expect, it } from 'vitest';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PlatformAdminGuard } from '../admin/platform-admin.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { ACCESS_COOKIE } from '../../common/auth.config';
import { PROFILES_BROWSER_ROUTES } from '../../common/cors';
import { allRoutes } from '../../test-support/routes';
import { AdminProfileReportsController } from './admin-profile-reports.controller';

const ctx = (req: Record<string, unknown>) => ({ switchToHttp: () => ({ getRequest: () => req }) }) as any;

describe('profile report routes (§6.15)', () => {
  it('guards every admin report and takedown route with PlatformAdminGuard', () => {
    for (const handler of ['list', 'resolve', 'moderate'] as const) {
      expect(Reflect.getMetadata(GUARDS_METADATA, AdminProfileReportsController.prototype[handler])).toContain(PlatformAdminGuard);
    }
    const admin = allRoutes().filter((r) => r.path.startsWith('/v1/admin/profile-reports') || r.path.includes('/v1/admin/profiles/'));
    expect(admin.length).toBe(3);
    expect(admin.every((r) => r.platformAdmin)).toBe(true);
  });

  it('keeps the public report route public and session-free', () => {
    const report = allRoutes().find((r) => r.target === 'POST /v1/profiles/:handle/report' && r.path === '/v1/profiles/:handle/report');
    expect(report).toBeDefined();
    expect(report!.platformAdmin).toBe(false);
    expect(report!.authenticated).toBe(false);
    expect(PROFILES_BROWSER_ROUTES.test('/v1/profiles/folake/report')).toBe(true);
  });

  it('lets a cookie-less report through CSRF, but not one that carries a session', () => {
    const guard = new CsrfGuard();
    expect(guard.canActivate(ctx({ method: 'POST', path: '/v1/profiles/folake/report', cookies: {}, headers: {} }))).toBe(true);
    expect(() =>
      guard.canActivate(ctx({ method: 'POST', path: '/v1/profiles/folake/report', cookies: { [ACCESS_COOKIE]: 'a' }, headers: {} })),
    ).toThrow();
  });
});
