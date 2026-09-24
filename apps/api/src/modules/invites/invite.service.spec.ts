import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { InviteService, normalizeInviteCode } from './invite.service';

const TENANT = 4n;
const DAY = 24 * 60 * 60 * 1000;

function invite(over: Record<string, unknown> = {}) {
  return {
    id: 1n,
    code: 'DESK-TEST',
    tier: 'PRO',
    durationDays: 90,
    maxUses: 10,
    usedCount: 0,
    redeemBy: null as Date | null,
    note: null,
    isActive: true,
    createdAt: new Date(),
    ...over,
  };
}

function makeService({
  code = invite() as ReturnType<typeof invite> | null,
  tenant = { id: TENANT, inviteCodeId: null as bigint | null, subscriptionStatus: null as string | null },
  claimed = [{ id: 1n, tier: 'PRO', durationDays: 90 }] as Array<{ id: bigint; tier: string; durationDays: number }>,
} = {}) {
  const prisma: any = {
    inviteCode: {
      findUnique: vi.fn().mockResolvedValue(code),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 2n, usedCount: 0, isActive: true, createdAt: new Date(), ...data })),
    },
    tenant: {
      findUnique: vi.fn().mockResolvedValue(tenant),
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    $queryRaw: vi.fn().mockResolvedValue(claimed),
  };
  return { service: new InviteService(prisma), prisma };
}

describe('invite codes', () => {
  it('are compared without regard to case or spaces', () => {
    expect(normalizeInviteCode(' desk-ab 12 ')).toBe('DESK-AB12');
  });

  describe('redeeming', () => {
    it('gives the practice the plan until the end of the period', async () => {
      const { service, prisma } = makeService();
      const before = Date.now();
      const result = await service.redeem(TENANT, 'desk-test');

      const data = prisma.tenant.update.mock.calls[0][0].data;
      expect(data.subscriptionTier).toBe('PRO');
      expect(data.inviteCodeId).toBe(1n);
      const days = (data.complimentaryUntil.getTime() - before) / DAY;
      expect(days).toBeGreaterThan(89.99);
      expect(days).toBeLessThan(90.01);
      expect(result.tier).toBe('PRO');
    });

    // The claim is the only thing standing between two practices and the
    // last use of a code; it has to carry every condition itself.
    it('claims the use in one conditional update', async () => {
      const { service, prisma } = makeService();
      await service.redeem(TENANT, 'DESK-TEST');
      const sql = prisma.$queryRaw.mock.calls[0][0].join('?');
      expect(sql).toMatch(/"usedCount" = "usedCount" \+ 1/);
      expect(sql).toMatch(/"isActive" = true/);
      expect(sql).toMatch(/"maxUses" IS NULL OR "usedCount" < "maxUses"/);
      expect(sql).toMatch(/"redeemBy" IS NULL OR "redeemBy" > NOW\(\)/);
    });

    it('gives nothing when the last use went to someone else first', async () => {
      const { service, prisma } = makeService({ claimed: [] });
      await expect(service.redeem(TENANT, 'DESK-TEST')).rejects.toThrow(/used up/);
      expect(prisma.tenant.update).not.toHaveBeenCalled();
    });

    it('is once per practice', async () => {
      const { service, prisma } = makeService({ tenant: { id: TENANT, inviteCodeId: 9n, subscriptionStatus: null } });
      await expect(service.redeem(TENANT, 'DESK-TEST')).rejects.toThrow(/already used/);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    // Would otherwise start a clock that later drops a paying practice to Starter.
    it('is refused for a practice that already pays', async () => {
      const { service, prisma } = makeService({ tenant: { id: TENANT, inviteCodeId: null, subscriptionStatus: 'active' } });
      await expect(service.redeem(TENANT, 'DESK-TEST')).rejects.toThrow(/paid plan/);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it.each([
      ['an unknown code', null, /not valid/],
      ['a switched-off code', invite({ isActive: false }), /not valid/],
      ['a code past its redeem-by date', invite({ redeemBy: new Date(Date.now() - DAY) }), /expired/],
      ['a fully used code', invite({ maxUses: 3, usedCount: 3 }), /fully used/],
    ])('explains %s', async (_label, code, message) => {
      const { service } = makeService({ code: code as any });
      await expect(service.redeem(TENANT, 'X-CODE')).rejects.toThrow(message);
    });
  });

  describe('ending complimentary periods', () => {
    it('moves a practice that has not started paying back to Starter', async () => {
      const { service, prisma } = makeService();
      prisma.tenant.findMany.mockResolvedValue([{ id: TENANT, subscriptionStatus: null }]);
      const result = await service.expireComplimentary();
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: TENANT },
        data: { subscriptionTier: 'STARTER', complimentaryUntil: null },
      });
      expect(result).toEqual({ ended: 1, downgraded: 1 });
    });

    it('leaves a practice that now pays on its plan', async () => {
      const { service, prisma } = makeService();
      prisma.tenant.findMany.mockResolvedValue([{ id: TENANT, subscriptionStatus: 'active' }]);
      await service.expireComplimentary();
      expect(prisma.tenant.update).toHaveBeenCalledWith({ where: { id: TENANT }, data: { complimentaryUntil: null } });
    });

    it('only looks at periods that have ended', async () => {
      const { service, prisma } = makeService();
      prisma.tenant.findMany.mockResolvedValue([]);
      const now = new Date('2026-12-23T10:00:00Z');
      await service.expireComplimentary(now);
      expect(prisma.tenant.findMany.mock.calls[0][0].where).toEqual({ complimentaryUntil: { lte: now } });
    });
  });

  describe('creating', () => {
    it('makes a readable code when none is given', async () => {
      const { service } = makeService();
      const created = await service.create({ tier: 'pro' });
      expect(created.code).toMatch(/^DESK-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      expect(created.tier).toBe('PRO');
      expect(created.durationDays).toBe(90);
    });

    it.each([
      [{ tier: 'STARTER' }, /Pro or Clinic/],
      [{ tier: 'PRO', durationDays: 0 }, /between 1 and 730/],
      [{ tier: 'PRO', maxUses: 0 }, /at least 1/],
      [{ tier: 'PRO', redeemBy: '2020-01-01' }, /future/],
      [{ tier: 'PRO', code: 'no' }, /4 to 40/],
    ])('refuses %o', async (dto, message) => {
      const { service } = makeService();
      const attempt = service.create(dto as any);
      await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
      await expect(attempt).rejects.toThrow(message);
    });
  });
});
