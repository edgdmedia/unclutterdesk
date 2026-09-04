import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY, STAFF } from './roles';

/**
 * A revoked session stops working straight away.
 *
 * Sessions became revocable, but an access token is a stateless JWT and
 * nothing checked it against its session. Revoking one stopped the refresh and
 * left that device fully authorised until the token expired — fifteen minutes.
 *
 * Fifteen minutes is a long time in every case where revocation happens.
 * "Sign out this device" is someone who no longer trusts a machine. Changing a
 * password revokes the other sessions because the owner thinks somebody has
 * it. Closing a practice ends its staff's access. Each is a person acting on a
 * suspicion, and each left the other party working for a further quarter hour.
 *
 * These tests are the reason that window is closed rather than documented.
 */
const SESSION = 'session-1';
const ACTIVE = { role: 'THERAPIST', status: 'active' };

function makeGuard(over: { profile?: unknown; session?: unknown } = {}) {
  const prisma: any = {
    profile: {
      findFirst: vi.fn().mockResolvedValue('profile' in over ? over.profile : ACTIVE),
    },
    token: {
      findFirst: vi.fn().mockResolvedValue(
        'session' in over
          ? over.session
          : { revokedAt: null, expiresAt: new Date(Date.now() + 60_000) },
      ),
    },
  };
  const reflector: any = { getAllAndOverride: vi.fn().mockReturnValue(STAFF) };
  return { guard: new RolesGuard(reflector, prisma), prisma, reflector };
}

function context(user: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

const signedIn = { profileId: '5', tenantId: '1', sessionId: SESSION };

describe('a live session', () => {
  it('is allowed through', async () => {
    const { guard } = makeGuard();
    await expect(guard.canActivate(context(signedIn))).resolves.toBe(true);
  });

  it('is looked up by its own id', async () => {
    const { guard, prisma } = makeGuard();
    await guard.canActivate(context(signedIn));
    expect(prisma.token.findFirst.mock.calls[0][0].where).toMatchObject({
      id: SESSION,
      type: 'refresh',
    });
  });

  it('never returns the token hash to the caller', async () => {
    const { guard, prisma } = makeGuard();
    await guard.canActivate(context(signedIn));
    expect(prisma.token.findFirst.mock.calls[0][0].select).not.toHaveProperty('tokenHash');
  });
});

describe('a session that has been revoked', () => {
  it('is refused on the next request, not in fifteen minutes', async () => {
    const { guard } = makeGuard({
      session: { revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) },
    });
    await expect(guard.canActivate(context(signedIn))).rejects.toThrow(ForbiddenException);
  });

  it('says the session ended rather than blaming the role', async () => {
    const { guard } = makeGuard({ session: { revokedAt: new Date(), expiresAt: new Date() } });
    await expect(guard.canActivate(context(signedIn))).rejects.toThrow(/session has ended/i);
  });

  // "Sign out everywhere" deletes rows in some paths and marks them in others.
  it('is refused when the row is gone entirely', async () => {
    const { guard } = makeGuard({ session: null });
    await expect(guard.canActivate(context(signedIn))).rejects.toThrow(ForbiddenException);
  });
});

describe('a session that has expired', () => {
  it('is refused even though it was never revoked', async () => {
    const { guard } = makeGuard({
      session: { revokedAt: null, expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(guard.canActivate(context(signedIn))).rejects.toThrow(ForbiddenException);
  });
});

describe('a token from before sessions existed', () => {
  /*
   * These carry no sid. They cannot be checked against anything, and refusing
   * them would sign every user out the moment this deployed. They expire within
   * the refresh TTL, after which every token in circulation is session-backed.
   */
  it('is allowed through on its profile alone', async () => {
    const { guard, prisma } = makeGuard();
    const legacy = { profileId: '5', tenantId: '1' };
    await expect(guard.canActivate(context(legacy))).resolves.toBe(true);
    expect(prisma.token.findFirst).not.toHaveBeenCalled();
  });
});

describe('the other refusals still stand', () => {
  it('a deactivated profile is refused even with a live session', async () => {
    const { guard } = makeGuard({ profile: { role: 'THERAPIST', status: 'inactive' } });
    await expect(guard.canActivate(context(signedIn))).rejects.toThrow(/not active/i);
  });

  it('a profile in another practice is refused', async () => {
    const { guard } = makeGuard({ profile: null });
    await expect(guard.canActivate(context(signedIn))).rejects.toThrow(/not found in this practice/i);
  });

  it('a role that is not permitted is refused', async () => {
    const { guard } = makeGuard({ profile: { role: 'CLIENT', status: 'active' } });
    await expect(guard.canActivate(context(signedIn))).rejects.toThrow(/does not have access/i);
  });

  // The session check must not become a way past the role check.
  it('a live session does not excuse the wrong role', async () => {
    const { guard, reflector } = makeGuard({
      profile: { role: 'RECEPTIONIST', status: 'active' },
    });
    reflector.getAllAndOverride.mockReturnValue(['OWNER']);
    await expect(guard.canActivate(context(signedIn))).rejects.toThrow(/does not have access/i);
  });
});

describe('what the guard reads', () => {
  it('checks the profile and the session together rather than in sequence', async () => {
    const { guard, prisma } = makeGuard();
    await guard.canActivate(context(signedIn));
    expect(prisma.profile.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.token.findFirst).toHaveBeenCalledTimes(1);
  });

  it('scopes the profile read to the tenant in the token', async () => {
    const { guard, prisma } = makeGuard();
    await guard.canActivate(context(signedIn));
    expect(prisma.profile.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 5n,
      tenantId: 1n,
    });
  });

  it('does nothing at all when the route declares no roles', async () => {
    const { guard, prisma, reflector } = makeGuard();
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(context(signedIn))).resolves.toBe(true);
    expect(prisma.token.findFirst).not.toHaveBeenCalled();
    expect(prisma.profile.findFirst).not.toHaveBeenCalled();
  });
});

describe('the metadata key', () => {
  it('is the one the decorators write', () => {
    const { guard, reflector } = makeGuard();
    void guard.canActivate(context(signedIn));
    expect(reflector.getAllAndOverride.mock.calls[0][0]).toBe(ROLES_KEY);
  });
});
