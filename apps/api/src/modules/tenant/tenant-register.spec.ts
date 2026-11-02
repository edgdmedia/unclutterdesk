import { describe, it, expect } from 'vitest';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ForbiddenException } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { PlatformAdminGuard } from '../admin/platform-admin.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { ACCESS_COOKIE, CSRF_COOKIE } from '../../common/auth.config';
import { allRoutes } from '../../test-support/routes';

const TOKEN = 'a'.repeat(64);
const session = { [ACCESS_COOKIE]: 'access', [CSRF_COOKIE]: TOKEN };

describe('POST /v1/tenant/register', () => {
  it('guards POST /v1/tenant/register with PlatformAdminGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, TenantController.prototype.createTenant);
    expect(guards).toContain(PlatformAdminGuard);
  });

  it('is no longer CSRF-exempt', () => {
    const guard = new CsrfGuard();
    // With a session cookie but no CSRF header, the exempt route would pass.
    // Now that it's not exempt, it should throw ForbiddenException.
    expect(() =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'POST',
            path: '/v1/tenant/register',
            cookies: session,
            headers: {},
          }),
        }),
      } as any),
    ).toThrow(ForbiddenException);
  });

  it('is not reachable by a practice role', () => {
    const route = allRoutes().find((r) => r.target === 'POST /v1/tenant/register');
    expect(route).toBeDefined();
    expect(route!.platformAdmin).toBe(true);
  });
});