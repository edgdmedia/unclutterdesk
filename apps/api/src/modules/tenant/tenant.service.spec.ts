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
