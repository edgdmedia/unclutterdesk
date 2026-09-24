import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Claiming a staff invitation.
 *
 * The claim page called no API at all: it collected a password and navigated to
 * /dashboard, so an invited colleague arrived with no account. Worse, the token
 * it would have carried was `invite-${Date.now()}-${Math.random()...}` — both
 * halves guessable — and claiming one grants a role inside a practice, with
 * access to clinical records. The token is now 32 random bytes, and the claim
 * consumes it inside the same transaction that creates the profile.
 */
const TENANT = 4n;

function makeService({
  invite,
  existingProfile = null,
  existingUser = null,
  consumed = 1,
}: {
  invite?: any;
  existingProfile?: any;
  existingUser?: any;
  consumed?: number;
} = {}) {
  const row = invite === undefined
    ? {
        id: 77n,
        tenantId: TENANT,
        email: 'Segun@Practice.NG',
        role: 'THERAPIST',
        claimToken: 'a'.repeat(64),
        expiresAt: new Date(Date.now() + 86400000),
      }
    : invite;

  const tx: any = {
    consultPendingInvite: { deleteMany: vi.fn().mockResolvedValue({ count: consumed }) },
    user: {
      findUnique: vi.fn().mockResolvedValue(existingUser),
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: 30n, ...data })),
    },
    profile: {
      create: vi.fn().mockImplementation(async ({ data }: any) => ({
        id: 40n,
        userId: existingUser?.id ?? 30n,
        avatarUrl: null,
        ...data,
      })),
    },
  };

  const prisma: any = {
    consultPendingInvite: { findUnique: vi.fn().mockResolvedValue(row) },
    profile: { findFirst: vi.fn().mockResolvedValue(existingProfile) },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
  };

  const sessions = { startSession: vi.fn().mockResolvedValue(undefined) };
  const service = new AuthService(
    prisma,
    { sign: vi.fn((_p: any, o: any) => (o?.secret ? 'refresh.jwt' : 'access.jwt')) } as any,
    { notify: vi.fn() } as any,
    sessions as any,
  );
  return { service, prisma, tx, sessions };
}

const dto = { token: 'a'.repeat(64), password: 'correct horse', firstName: 'Segun', lastName: 'Ade' };

describe('AuthService.claimInvite', () => {
  describe('a valid invitation', () => {
    let service: AuthService;
    let tx: any;

    beforeEach(() => {
      ({ service, tx } = makeService());
    });

    it('creates the profile in the inviting practice', async () => {
      await service.claimInvite(dto);
      expect(tx.profile.create.mock.calls[0][0].data).toMatchObject({ tenantId: TENANT });
    });

    it('grants the role the inviter chose, not one the claimant supplies', async () => {
      await service.claimInvite({ ...dto, role: 'OWNER' } as any);
      expect(tx.profile.create.mock.calls[0][0].data.role).toBe('THERAPIST');
    });

    it('stores the address in lower case, as the invite was addressed', async () => {
      await service.claimInvite(dto);
      expect(tx.profile.create.mock.calls[0][0].data.email).toBe('segun@practice.ng');
    });

    it('treats the address as verified, since the invite reached it', async () => {
      await service.claimInvite(dto);
      expect(tx.profile.create.mock.calls[0][0].data.emailVerified).toBe(true);
    });

    it('signs the claimant in', async () => {
      const result = await service.claimInvite(dto);
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.profile.email).toBe('segun@practice.ng');
    });

    it('never returns the password hash', async () => {
      const result = await service.claimInvite(dto);
      expect(JSON.stringify(result)).not.toContain('$2');
    });

    it('does not store the password in clear', async () => {
      await service.claimInvite(dto);
      const written = tx.user.create.mock.calls[0][0].data.password;
      expect(written).not.toBe(dto.password);
      expect(written).toMatch(/^\$2[aby]\$/);
    });
  });

  describe('consuming the token', () => {
    it('deletes the invitation', async () => {
      const { service, tx } = makeService();
      await service.claimInvite(dto);
      expect(tx.consultPendingInvite.deleteMany).toHaveBeenCalledWith({ where: { id: 77n } });
    });

    it('consumes it before creating the profile, so a race cannot double-claim', async () => {
      const { service, tx } = makeService();
      const order: string[] = [];
      tx.consultPendingInvite.deleteMany.mockImplementation(async () => {
        order.push('consume');
        return { count: 1 };
      });
      tx.profile.create.mockImplementation(async () => {
        order.push('profile');
        return { id: 40n, userId: 30n, tenantId: TENANT, email: 'x', type: 'staff' };
      });
      await service.claimInvite(dto);
      expect(order).toEqual(['consume', 'profile']);
    });

    it('refuses when another request consumed it first', async () => {
      const { service, tx } = makeService({ consumed: 0 });
      await expect(service.claimInvite(dto)).rejects.toThrow(BadRequestException);
      expect(tx.profile.create).not.toHaveBeenCalled();
    });
  });

  describe('refusals', () => {
    it('an unknown token', async () => {
      const { service } = makeService({ invite: null });
      await expect(service.claimInvite(dto)).rejects.toThrow(BadRequestException);
    });

    it('an expired token', async () => {
      const { service, tx } = makeService({
        invite: {
          id: 77n,
          tenantId: TENANT,
          email: 'segun@practice.ng',
          role: 'THERAPIST',
          expiresAt: new Date(Date.now() - 1000),
        },
      });
      await expect(service.claimInvite(dto)).rejects.toThrow(BadRequestException);
      expect(tx.consultPendingInvite.deleteMany).not.toHaveBeenCalled();
    });

    // An unknown token and an expired one must be indistinguishable, or the
    // endpoint becomes an oracle for which invitations exist.
    it('says the same thing for unknown and expired', async () => {
      const unknown = await makeService({ invite: null })
        .service.claimInvite(dto)
        .catch((e) => e.message);
      const expired = await makeService({
        invite: { id: 1n, tenantId: TENANT, email: 'a@b.c', role: 'THERAPIST', expiresAt: new Date(0) },
      })
        .service.claimInvite(dto)
        .catch((e) => e.message);
      expect(unknown).toBe(expired);
    });

    it('a password too short to be worth hashing', async () => {
      const { service, tx } = makeService();
      await expect(service.claimInvite({ ...dto, password: 'short' })).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.profile.create).not.toHaveBeenCalled();
    });

    it('an address that already has a profile in that practice', async () => {
      const { service, tx } = makeService({ existingProfile: { id: 9n } });
      await expect(service.claimInvite(dto)).rejects.toThrow(BadRequestException);
      expect(tx.consultPendingInvite.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('someone who already works at another practice', () => {
    // One login, several practices: the second claim must attach to the
    // existing user rather than fail on the unique email.
    it('reuses the existing login', async () => {
      const { service, tx } = makeService({ existingUser: { id: 12n, email: 'segun@practice.ng' } });
      await service.claimInvite(dto);
      expect(tx.user.create).not.toHaveBeenCalled();
      expect(tx.profile.create.mock.calls[0][0].data.userId).toBe(12n);
    });

    it('still gives them a separate profile in the new practice', async () => {
      const { service, tx } = makeService({ existingUser: { id: 12n, email: 'segun@practice.ng' } });
      await service.claimInvite(dto);
      expect(tx.profile.create.mock.calls[0][0].data.tenantId).toBe(TENANT);
    });
  });
});
