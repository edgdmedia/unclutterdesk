import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, test, vi } from 'vitest';
import { TenantService } from './tenant.service';

function createPrismaMock() {
  return {
    tenant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    profile: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  } as any;
}

describe('TenantService custom domain flow', () => {
  test('rejects invalid custom domain values', async () => {
    const prisma = createPrismaMock();
    const service = new TenantService(prisma);

    prisma.tenant.findUnique.mockResolvedValue({
      id: BigInt(1),
      subscriptionTier: 'PRO',
    });

    await expect(
      service.updateTenantBrand(BigInt(1), {
        customDomain: 'https://booking.example.com/path',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test('rejects custom domains for starter tier', async () => {
    const prisma = createPrismaMock();
    const service = new TenantService(prisma);

    prisma.tenant.findUnique.mockResolvedValue({
      id: BigInt(1),
      subscriptionTier: 'STARTER',
    });

    await expect(
      service.updateTenantBrand(BigInt(1), {
        customDomain: 'booking.example.com',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('marks a configured custom domain as active when verified', async () => {
    const prisma = createPrismaMock();
    const service = new TenantService(prisma);

    prisma.tenant.findUnique.mockResolvedValue({
      id: BigInt(1),
      customDomain: 'booking.example.com',
    });

    prisma.tenant.update.mockResolvedValue({
      id: BigInt(1),
      customDomain: 'booking.example.com',
      customDomainStatus: 'ACTIVE',
    });

    const result = await service.verifyCustomDomain(BigInt(1));

    expect(result).toEqual({
      id: '1',
      customDomain: 'booking.example.com',
      customDomainStatus: 'ACTIVE',
    });
  });
});

describe('TenantService staff role guard', () => {
  test('rejects role changes from therapists', async () => {
    const prisma = createPrismaMock();
    prisma.profile.findFirst.mockResolvedValueOnce({ id: BigInt(2), role: 'THERAPIST' });
    const service = new TenantService(prisma);

    await expect(service.updateStaffRole(BigInt(1), BigInt(2), BigInt(3), 'OWNER')).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('rejects admin assigning the owner role', async () => {
    const prisma = createPrismaMock();
    prisma.profile.findFirst.mockResolvedValueOnce({ id: BigInt(5), role: 'ADMIN' });
    const service = new TenantService(prisma);

    await expect(service.updateStaffRole(BigInt(1), BigInt(5), BigInt(2), 'OWNER')).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('allows admin to assign a staff role within the tenant', async () => {
    const prisma = createPrismaMock();
    prisma.profile.findFirst.mockResolvedValueOnce({ id: BigInt(5), role: 'ADMIN' });
    prisma.profile.findFirst.mockResolvedValueOnce({ id: BigInt(2), role: 'RECEPTIONIST' });
    prisma.profile.update.mockResolvedValue({ id: BigInt(2), role: 'THERAPIST' });
    const service = new TenantService(prisma);

    const result = await service.updateStaffRole(BigInt(1), BigInt(5), BigInt(2), 'THERAPIST');
    expect(result).toEqual({ id: '2', role: 'THERAPIST' });
  });

  test('rejects targets outside the tenant or client profiles', async () => {
    const prisma = createPrismaMock();
    prisma.profile.findFirst.mockResolvedValueOnce({ id: BigInt(1), role: 'OWNER' });
    prisma.profile.findFirst.mockResolvedValueOnce(null);
    const service = new TenantService(prisma);

    await expect(service.updateStaffRole(BigInt(1), BigInt(1), BigInt(99), 'THERAPIST')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TenantService.getPublicTenantExistence', () => {
  test('reports an active practice as existing and active', async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findFirst.mockResolvedValue({ isActive: true });
    const service = new TenantService(prisma);

    await expect(service.getPublicTenantExistence('dr-smith')).resolves.toEqual({
      exists: true,
      active: true,
    });
  });

  // The whole point of this probe: getPublicTenantInfo filters on isActive, so
  // it cannot tell "no such practice" from "practice paused". The edge router
  // must serve a paused practice rather than 404 it, because clients with
  // sessions already booked still need to reach the inactive-practice page.
  test('reports a deactivated practice as existing but inactive', async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findFirst.mockResolvedValue({ isActive: false });
    const service = new TenantService(prisma);

    await expect(service.getPublicTenantExistence('paused')).resolves.toEqual({
      exists: true,
      active: false,
    });
  });

  test('does not filter on isActive when looking the practice up', async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findFirst.mockResolvedValue({ isActive: false });
    const service = new TenantService(prisma);

    await service.getPublicTenantExistence('paused');
    expect(prisma.tenant.findFirst.mock.calls[0][0].where).not.toHaveProperty('isActive');
  });

  test('reports a missing practice as not existing', async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findFirst.mockResolvedValue(null);
    const service = new TenantService(prisma);

    await expect(service.getPublicTenantExistence('nope')).resolves.toEqual({
      exists: false,
      active: false,
    });
  });

  test('matches on slug or custom domain, case-insensitively', async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findFirst.mockResolvedValue({ isActive: true });
    const service = new TenantService(prisma);

    await service.getPublicTenantExistence('  Booking.DrJane.com  ');
    expect(prisma.tenant.findFirst.mock.calls[0][0].where.OR).toEqual([
      { slug: 'booking.drjane.com' },
      { customDomain: 'booking.drjane.com' },
    ]);
  });

  test('returns only existence flags, never practice detail', async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findFirst.mockResolvedValue({ isActive: true });
    const service = new TenantService(prisma);

    const result = await service.getPublicTenantExistence('dr-smith');
    expect(Object.keys(result).sort()).toEqual(['active', 'exists']);
    expect(prisma.tenant.findFirst.mock.calls[0][0].select).toEqual({ isActive: true });
  });
});
