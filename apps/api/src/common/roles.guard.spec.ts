import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { CLINICAL, PRACTICE_ADMIN, STAFF } from './roles';

function makeGuard(required: string[] | undefined, profile: any) {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(required) } as any;
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

const active = (role: string) => ({ role, status: 'active' });

describe('RolesGuard', () => {
  describe('role matching', () => {
    it('allows a role on the list', async () => {
      const { guard } = makeGuard(CLINICAL, active('THERAPIST'));
      await expect(guard.canActivate(ctx().host)).resolves.toBe(true);
    });

    // The exposure that motivated the guard: a signed-in client could read
    // another client's SOAP notes.
    it('refuses a client on a clinical route', async () => {
      const { guard } = makeGuard(CLINICAL, active('CLIENT'));
      await expect(guard.canActivate(ctx().host)).rejects.toThrow(ForbiddenException);
    });

    it('refuses a receptionist on a clinical route', async () => {
      const { guard } = makeGuard(CLINICAL, active('RECEPTIONIST'));
      await expect(guard.canActivate(ctx().host)).rejects.toThrow(ForbiddenException);
    });

    it('refuses a therapist on a practice-admin route', async () => {
      const { guard } = makeGuard(PRACTICE_ADMIN, active('THERAPIST'));
      await expect(guard.canActivate(ctx().host)).rejects.toThrow(ForbiddenException);
    });

    it('allows a receptionist on a staff route', async () => {
      const { guard } = makeGuard(STAFF, active('RECEPTIONIST'));
      await expect(guard.canActivate(ctx().host)).resolves.toBe(true);
    });

    it('refuses a client on a staff route', async () => {
      const { guard } = makeGuard(STAFF, active('CLIENT'));
      await expect(guard.canActivate(ctx().host)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('where the role comes from', () => {
    // The access token carries no role — generateTokens sets only sub,
    // profileId, tenantId and type — so a token-based check would read every
    // practice user as a client.
    it('reads the role from the database, not the token', async () => {
      const { guard, prisma } = makeGuard(PRACTICE_ADMIN, active('OWNER'));
      const { host } = ctx({ profileId: '5', tenantId: '1', roles: ['client'] });
      await expect(guard.canActivate(host)).resolves.toBe(true);
      expect(prisma.profile.findFirst).toHaveBeenCalled();
    });

    it('scopes the profile lookup to the tenant in the token', async () => {
      const { guard, prisma } = makeGuard(STAFF, active('ADMIN'));
      await guard.canActivate(ctx({ profileId: '7', tenantId: '3' }).host);
      expect(prisma.profile.findFirst.mock.calls[0][0].where).toMatchObject({
        id: 7n,
        tenantId: 3n,
      });
    });

    it('exposes the role to downstream handlers', async () => {
      const { guard } = makeGuard(STAFF, active('ADMIN'));
      const { req, host } = ctx();
      await guard.canActivate(host);
      expect(req.user.role).toBe('ADMIN');
    });
  });

  describe('refusals that are not about role', () => {
    it('refuses a deactivated profile', async () => {
      // Otherwise removing someone's access would not take effect until their
      // 15-minute access token expired.
      const { guard } = makeGuard(STAFF, { role: 'ADMIN', status: 'inactive' });
      await expect(guard.canActivate(ctx().host)).rejects.toThrow(ForbiddenException);
    });

    it('refuses an erased profile', async () => {
      const { guard } = makeGuard(STAFF, { role: 'CLIENT', status: 'erased' });
      await expect(guard.canActivate(ctx().host)).rejects.toThrow(ForbiddenException);
    });

    it('refuses when the profile is not in that tenant', async () => {
      const { guard } = makeGuard(STAFF, null);
      await expect(guard.canActivate(ctx().host)).rejects.toThrow(ForbiddenException);
    });

    it('refuses a platform-admin token, which has no practice profile', async () => {
      const { guard } = makeGuard(STAFF, active('ADMIN'));
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

    it('treats an empty role list the same way', async () => {
      const { guard } = makeGuard([], active('CLIENT'));
      await expect(guard.canActivate(ctx().host)).resolves.toBe(true);
    });
  });
});
