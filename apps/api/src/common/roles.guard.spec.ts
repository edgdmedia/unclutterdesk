import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { PERMISSIONS_KEY } from './permissions';
import { PLATFORM_ADMIN_KEY } from './roles';

/** The reflector answers per key, so each spec drives exactly one annotation. */
function makeGuard(required: string[] | undefined, profile: any) {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) => (key === PERMISSIONS_KEY ? required : undefined)),
  } as any;
  const prisma = { profile: { findFirst: vi.fn().mockResolvedValue(profile) } } as any;
  return { guard: new RolesGuard(reflector, prisma), prisma };
}

function ctx(user: any = { profileId: '5', tenantId: '1' }) {
  const req: any = { user };
  return {
    req,
    host: {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as any,
  };
}

const active = (role: string, permissions: string[] = []) => ({ role, status: 'active', permissions });

describe('RolesGuard', () => {
  describe('permission matching', () => {
    it('allows a role whose map holds the key', async () => {
      const { guard } = makeGuard(['clinical.record'], active('THERAPIST'));
      await expect(guard.canActivate(ctx().host)).resolves.toBe(true);
    });

    // The exposure that motivated the guard: a signed-in client could read
    // another client's SOAP notes.
    it('refuses a client on a clinical route', async () => {
      const { guard } = makeGuard(['clinical.record'], active('CLIENT'));
      await expect(guard.canActivate(ctx().host)).rejects.toThrow(ForbiddenException);
    });

    it('refuses a receptionist on a clinical route', async () => {
      const { guard } = makeGuard(['clinical.record'], active('RECEPTIONIST'));
      await expect(guard.canActivate(ctx().host)).rejects.toThrow(ForbiddenException);
    });

    it('refuses a therapist on a practice-admin route', async () => {
      const { guard } = makeGuard(['practice.admin'], active('THERAPIST'));
      await expect(guard.canActivate(ctx().host)).rejects.toThrow(ForbiddenException);
    });

    it('allows a receptionist on a staff route', async () => {
      const { guard } = makeGuard(['practice.staff'], active('RECEPTIONIST'));
      await expect(guard.canActivate(ctx().host)).resolves.toBe(true);
    });

    it('refuses a client on a staff route', async () => {
      const { guard } = makeGuard(['practice.staff'], active('CLIENT'));
      await expect(guard.canActivate(ctx().host)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('grants', () => {
    it('let a therapist through on a key their role lacks', async () => {
      const { guard } = makeGuard(['sessions.edit'], active('THERAPIST', ['sessions.edit']));
      await expect(guard.canActivate(ctx().host)).resolves.toBe(true);
    });
    it('pass when any one of the listed keys is held', async () => {
      const { guard } = makeGuard(['practice.admin', 'clinical.record'], active('THERAPIST'));
      await expect(guard.canActivate(ctx().host)).resolves.toBe(true);
    });
    it('are read with the role, and handed down to the request', async () => {
      const { guard, prisma } = makeGuard(['practice.staff'], active('THERAPIST', ['sessions.edit']));
      const { req, host } = ctx();
      await guard.canActivate(host);
      expect(prisma.profile.findFirst.mock.calls[0][0].select).toMatchObject({ role: true, status: true, permissions: true });
      expect(req.user.role).toBe('THERAPIST');
      expect(req.user.permissions).toEqual(['sessions.edit']);
    });
  });

  describe('where the role comes from', () => {
    // The access token carries no role — generateTokens sets only sub,
    // profileId, tenantId and type — so a token-based check would read every
    // practice user as a client.
    it('reads the role from the database, not the token', async () => {
      const { guard, prisma } = makeGuard(['practice.admin'], active('OWNER'));
      const { host } = ctx({ profileId: '5', tenantId: '1', roles: ['client'] });
      await expect(guard.canActivate(host)).resolves.toBe(true);
      expect(prisma.profile.findFirst).toHaveBeenCalled();
    });

    it('scopes the profile lookup to the tenant in the token', async () => {
      const { guard, prisma } = makeGuard(['practice.staff'], active('ADMIN'));
      await guard.canActivate(ctx({ profileId: '7', tenantId: '3' }).host);
      expect(prisma.profile.findFirst.mock.calls[0][0].where).toMatchObject({
        id: 7n,
        tenantId: 3n,
      });
    });

    it('exposes the role to downstream handlers', async () => {
      const { guard } = makeGuard(['practice.staff'], active('ADMIN'));
      const { req, host } = ctx();
      await guard.canActivate(host);
      expect(req.user.role).toBe('ADMIN');
    });
  });

  describe('refusals that are not about permission', () => {
    it('refuses a deactivated profile', async () => {
      // Otherwise removing someone's access would not take effect until their
      // 15-minute access token expired.
      const { guard } = makeGuard(['practice.staff'], { role: 'ADMIN', status: 'inactive', permissions: [] });
      await expect(guard.canActivate(ctx().host)).rejects.toThrow(ForbiddenException);
    });

    it('refuses an erased profile', async () => {
      const { guard } = makeGuard(['practice.staff'], { role: 'CLIENT', status: 'erased', permissions: [] });
      await expect(guard.canActivate(ctx().host)).rejects.toThrow(ForbiddenException);
    });

    it('refuses when the profile is not in that tenant', async () => {
      const { guard } = makeGuard(['practice.staff'], null);
      await expect(guard.canActivate(ctx().host)).rejects.toThrow(ForbiddenException);
    });

    it('refuses a platform-admin token, which has no practice profile', async () => {
      const { guard } = makeGuard(['practice.staff'], active('ADMIN'));
      const { host } = ctx({ userId: '1', type: 'platform_admin' });
      await expect(guard.canActivate(host)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('routes with no annotation', () => {
    it('allows through, since roles.spec.ts fails the build if one is missing', async () => {
      const { guard, prisma } = makeGuard(undefined, active('CLIENT'));
      await expect(guard.canActivate(ctx().host)).resolves.toBe(true);
      expect(prisma.profile.findFirst).not.toHaveBeenCalled();
    });

    it('treats an empty permission list the same way', async () => {
      const { guard } = makeGuard([], active('CLIENT'));
      await expect(guard.canActivate(ctx().host)).resolves.toBe(true);
    });
  });
});

/*
 * A platform admin has no practice profile, so every permission check refused
 * them — including /v1/auth/status, which the admin console calls on page load.
 * Each refresh of an admin page logged the admin out. The exemption is opt-in
 * per endpoint, so nothing else opens up to them.
 */
describe('RolesGuard and platform admins', () => {
  function guardWith({ allowAdmin }: { allowAdmin: boolean }) {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) =>
        key === PLATFORM_ADMIN_KEY ? allowAdmin : ['practice.staff'],
      ),
    } as any;
    const prisma = {
      profile: { findFirst: vi.fn() },
      token: { findFirst: vi.fn().mockResolvedValue({ revokedAt: null, expiresAt: new Date(Date.now() + 60_000) }) },
    } as any;
    return new RolesGuard(reflector, prisma);
  }
  const admin = { type: 'platform_admin', userId: '1', sessionId: 's1' };

  it('admits a platform admin where the endpoint allows it', async () => {
    await expect(guardWith({ allowAdmin: true }).canActivate(ctx(admin).host)).resolves.toBe(true);
  });

  it('still refuses a platform admin everywhere else', async () => {
    await expect(guardWith({ allowAdmin: false }).canActivate(ctx(admin).host)).rejects.toThrow(ForbiddenException);
  });

  it('does not let a practice user skip the permission check through it', async () => {
    const guard = guardWith({ allowAdmin: true });
    const user = { profileId: '5', tenantId: '1', type: 'therapist' };
    await expect(guard.canActivate(ctx(user).host)).rejects.toThrow(ForbiddenException);
  });
});
