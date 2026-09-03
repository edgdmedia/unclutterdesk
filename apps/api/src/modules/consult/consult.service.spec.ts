import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConsultService } from './consult.service';

/**
 * Tenant isolation and authorisation on practitioner status.
 *
 * The route carried only JwtAuthGuard, so any signed-in account could reach
 * this — including a client — and the query ignored tenantId entirely, so any
 * profile on the platform could be deactivated by id. Deactivating a
 * practitioner takes them out of service and hides them from booking pages.
 */
const TENANT = 1n;
const ACTOR = 10n;
const TARGET = 20n;

function makeService() {
  const prisma: any = {
    profile: {
      findFirst: vi.fn().mockResolvedValue({ role: 'OWNER' }),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    consultTherapistProfile: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const service = new ConsultService(
    prisma, {} as any, {} as any, {} as any, {} as any, {} as any,
  );
  return { service, prisma };
}

describe('ConsultService.adminUpdateTherapistStatus', () => {
  let service: ConsultService;
  let prisma: any;

  beforeEach(() => {
    ({ service, prisma } = makeService());
  });

  describe('authorisation', () => {
    for (const role of ['OWNER', 'ADMIN']) {
      it(`allows ${role}`, async () => {
        prisma.profile.findFirst.mockResolvedValue({ role });
        await expect(
          service.adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'inactive'),
        ).resolves.toBeDefined();
      });
    }

    for (const role of ['THERAPIST', 'RECEPTIONIST', 'CLIENT']) {
      it(`refuses ${role}`, async () => {
        prisma.profile.findFirst.mockResolvedValue({ role });
        await expect(
          service.adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'inactive'),
        ).rejects.toThrow(ForbiddenException);
        expect(prisma.profile.updateMany).not.toHaveBeenCalled();
      });
    }

    it('looks the actor up within the acting tenant', async () => {
      await service.adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'active');
      expect(prisma.profile.findFirst.mock.calls[0][0].where).toMatchObject({
        id: ACTOR,
        tenantId: TENANT,
      });
    });
  });

  describe('tenant scoping', () => {
    it('scopes the status change to the tenant', async () => {
      await service.adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'inactive');
      expect(prisma.profile.updateMany).toHaveBeenCalledWith({
        where: { id: TARGET, tenantId: TENANT },
        data: { status: 'inactive' },
      });
    });

    it('never uses an unscoped update', async () => {
      await service.adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'inactive');
      expect(prisma.profile.update).not.toHaveBeenCalled();
    });

    it('refuses a practitioner from another practice', async () => {
      prisma.profile.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'inactive'),
      ).rejects.toThrow(NotFoundException);
    });

    it('does not leave the practitioner hidden when the update matched nothing', async () => {
      prisma.profile.updateMany.mockResolvedValue({ count: 0 });
      await service
        .adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'inactive')
        .catch(() => undefined);
      // The follow-up write must not run for a profile we did not change.
      expect(prisma.consultTherapistProfile.updateMany).not.toHaveBeenCalled();
    });
  });

  it('hides a deactivated practitioner from public booking pages', async () => {
    await service.adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'inactive');
    expect(prisma.consultTherapistProfile.updateMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT, profileId: TARGET },
      data: { isPublic: false },
    });
  });

  it('does not change visibility when reactivating', async () => {
    await service.adminUpdateTherapistStatus(TENANT, ACTOR, TARGET, 'active');
    expect(prisma.consultTherapistProfile.updateMany).not.toHaveBeenCalled();
  });
});
