import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Signing up with an invite code.
 *
 * A bad code has to be refused before anything is created: the email would
 * otherwise be taken by a half-made account, and the person could not simply
 * correct the code and try again.
 */
function makeService(invites: any) {
  const prisma: any = {
    user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 1n }) },
    tenant: { create: vi.fn().mockResolvedValue({ id: 4n }) },
    profile: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 5n, tenantId: 4n, email: 'ada@practice.ng', status: 'pending', emailVerified: false }),
    },
    token: { create: vi.fn(), deleteMany: vi.fn() },
    consultTherapistProfile: { create: vi.fn() },
  };
  const notifications: any = { sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  const service = new AuthService(prisma, {} as any, notifications, {} as any, invites);
  return { service, prisma };
}

const dto = {
  email: 'ada@practice.ng',
  password: 'Str0ng!Passw0rd',
  firstName: 'Ada',
  practiceName: 'Ada Therapy',
  type: 'therapist',
};

describe('signing up with an invite code', () => {
  it('refuses a bad code before creating anything', async () => {
    const invites = {
      assertUsable: vi.fn().mockRejectedValue(new BadRequestException('That invite code is not valid.')),
      redeem: vi.fn(),
    };
    const { service, prisma } = makeService(invites);
    await expect(service.register(undefined, { ...dto, inviteCode: 'NOPE' })).rejects.toThrow(/not valid/);
    expect(prisma.tenant.create).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('applies a good code to the new practice', async () => {
    const invites = {
      assertUsable: vi.fn().mockResolvedValue(undefined),
      redeem: vi.fn().mockResolvedValue({ tier: 'PRO', complimentaryUntil: '2026-12-23T00:00:00.000Z' }),
    };
    const { service } = makeService(invites);
    const result: any = await service.register(undefined, { ...dto, inviteCode: 'desk-test' });
    expect(invites.redeem).toHaveBeenCalledWith(4n, 'desk-test');
    expect(result.invite).toEqual({ tier: 'PRO', complimentaryUntil: '2026-12-23T00:00:00.000Z' });
  });

  // Someone else took the last use between the check and the claim.
  it('still creates the practice, on Starter, if the code runs out mid-signup', async () => {
    const invites = {
      assertUsable: vi.fn().mockResolvedValue(undefined),
      redeem: vi.fn().mockRejectedValue(new BadRequestException('That invite code has just been used up.')),
    };
    const { service, prisma } = makeService(invites);
    const result: any = await service.register(undefined, { ...dto, inviteCode: 'DESK-TEST' });
    expect(prisma.tenant.create).toHaveBeenCalled();
    expect(result.invite).toBeUndefined();
  });

  // Staff joining an existing practice cannot move its plan.
  it('ignores a code when joining an existing practice', async () => {
    const invites = { assertUsable: vi.fn(), redeem: vi.fn() };
    const { service } = makeService(invites);
    await service.register(9n, { ...dto, inviteCode: 'DESK-TEST' });
    expect(invites.assertUsable).not.toHaveBeenCalled();
    expect(invites.redeem).not.toHaveBeenCalled();
  });
});
