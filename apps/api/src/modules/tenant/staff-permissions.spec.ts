import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TenantService } from './tenant.service';

const TENANT = 1n;
const OWNER = 5n;
const TARGET = { id: 6n, role: 'THERAPIST', status: 'active', permissions: [] };

function make(over: { actor?: any; target?: any } = {}) {
  const actor = over.actor ?? { id: OWNER, role: 'OWNER' };
  const target = over.target === undefined ? TARGET : over.target;
  const prisma: any = {
    profile: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.id === OWNER) return actor;
        if (target && where.id === target.id) return target;
        return null;
      }),
      update: vi.fn(async ({ data }: any) => ({ ...target, ...data })),
    },
  };
  return { prisma, service: new TenantService(prisma, { sendEmail: vi.fn() } as any) };
}

describe('granting permissions', () => {
  it('stores a valid grant list, sorted and deduped', async () => {
    const { service, prisma } = make();
    const res = await service.updateStaffPermissions(TENANT, OWNER, 6n, ['sessions.edit', 'payments.desk', 'sessions.edit']);
    expect(prisma.profile.update.mock.calls[0][0].data.permissions).toEqual(['payments.desk', 'sessions.edit']);
    expect(res.permissions).toEqual(['payments.desk', 'sessions.edit']);
  });
  it('refuses keys outside the catalog', async () => {
    const { service } = make();
    await expect(service.updateStaffPermissions(TENANT, OWNER, 6n, ['made.up'])).rejects.toBeInstanceOf(BadRequestException);
  });
  it('refuses the structural keys by name', async () => {
    const { service } = make();
    await expect(service.updateStaffPermissions(TENANT, OWNER, 6n, ['practice.owner'])).rejects.toThrow(/cannot be granted/i);
    await expect(service.updateStaffPermissions(TENANT, OWNER, 6n, ['staff.manage'])).rejects.toThrow(/cannot be granted/i);
  });
  it('will not touch another practice, a client, or a missing member', async () => {
    const { service, prisma } = make({ target: null });
    await expect(service.updateStaffPermissions(TENANT, OWNER, 6n, [])).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });
  it('leaves the owner alone', async () => {
    const { service } = make({ target: { id: 7n, role: 'OWNER', status: 'active', permissions: [] } });
    await expect(service.updateStaffPermissions(TENANT, OWNER, 7n, ['sessions.edit'])).rejects.toBeInstanceOf(BadRequestException);
  });
  it('a non-admin actor is refused', async () => {
    const { service } = make({ actor: { id: OWNER, role: 'THERAPIST' } });
    await expect(service.updateStaffPermissions(TENANT, OWNER, 6n, [])).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('refuses a non-array body', async () => {
    const { service } = make();
    await expect(service.updateStaffPermissions(TENANT, OWNER, 6n, 'sessions.edit')).rejects.toBeInstanceOf(BadRequestException);
  });
});
