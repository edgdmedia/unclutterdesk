import { describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const setup = () => {
    const prisma: any = { adminAuditLog: { create: vi.fn(async ({ data }: any) => data), findMany: vi.fn().mockResolvedValue([]) } };
    return { audit: new AuditService(prisma), prisma };
  };

  it('records who did what to which record, and why', async () => {
    const { audit, prisma } = setup();
    await audit.record({ actorUserId: 3n, action: 'profile.takedown', targetType: 'PractitionerProfile', targetId: 12n, reason: ' impersonation ', meta: { reportId: '5' } });
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: { actorUserId: 3n, action: 'profile.takedown', targetType: 'PractitionerProfile', targetId: '12', reason: 'impersonation', metaJson: { reportId: '5' } },
    });
  });

  it.each(['Takedown', 'takedown', 'profile takedown'])('refuses the action name %j', async (action) => {
    const { audit } = setup();
    await expect(audit.record({ actorUserId: 3n, action, targetType: 'X', targetId: '1' })).rejects.toThrow(/dotted lowercase/);
  });

  it('offers no way to change or delete an entry', () => {
    const methods = Object.getOwnPropertyNames(AuditService.prototype);
    expect(methods.filter((m) => /update|delete|remove|edit/i.test(m))).toEqual([]);
  });
});
