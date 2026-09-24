import { BadRequestException } from '@nestjs/common';
import { describe, expect, test, vi } from 'vitest';
import { RESERVED_SLUGS, isPlatformHostname, isReservedSlug } from './reserved-slugs';
import { TenantService } from './tenant.service';

function createPrismaMock() {
  return {
    tenant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  } as any;
}

const notifications = { sendEmail: vi.fn() } as any;

describe('reserved slugs', () => {
  test('covers the names the platform and its mail use', () => {
    for (const slug of ['www', 'app', 'api', 'admin', 'book', 'mail', 'ns1', 'ns2', 'demo', 'unclutterdesk']) {
      expect(RESERVED_SLUGS.has(slug)).toBe(true);
    }
  });

  test('matches after the same normalisation the slug paths apply', () => {
    expect(isReservedSlug(' Admin ')).toBe(true);
    expect(isReservedSlug('a.p.i')).toBe(true);
    expect(isReservedSlug('dr-jane')).toBe(false);
  });

  test('no custom domain may sit under the platform apex', () => {
    expect(isPlatformHostname('unclutterdesk.com')).toBe(true);
    expect(isPlatformHostname('api.unclutterdesk.com')).toBe(true);
    expect(isPlatformHostname('another-practice.unclutterdesk.com')).toBe(true);
    expect(isPlatformHostname('booking.drjane.com')).toBe(false);
    expect(isPlatformHostname('notunclutterdesk.com')).toBe(false);
  });
});

describe('TenantService refuses reserved slugs', () => {
  test('on create', async () => {
    const prisma = createPrismaMock();
    const service = new TenantService(prisma, notifications);

    await expect(service.createTenant({ name: 'X', slug: 'api' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tenant.create).not.toHaveBeenCalled();
  });

  test('on rename, normalising the slug the way create does', async () => {
    const prisma = createPrismaMock();
    const service = new TenantService(prisma, notifications);
    prisma.tenant.findUnique.mockResolvedValue({ slug: 'dr-jane-4821' });

    await expect(service.updateTenantBrand(BigInt(1), { slug: 'Ad.min' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  test('but lets a tenant keep the reserved slug it already holds', async () => {
    const prisma = createPrismaMock();
    const service = new TenantService(prisma, notifications);
    prisma.tenant.findUnique.mockResolvedValue({ slug: 'demo' });
    prisma.tenant.update.mockResolvedValue({});

    await service.updateTenantBrand(BigInt(1), { slug: 'demo' });
    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'demo' }) }),
    );
  });

  test('availability reports reserved slugs as taken, except for their holder', async () => {
    const prisma = createPrismaMock();
    const service = new TenantService(prisma, notifications);

    prisma.tenant.findUnique.mockResolvedValue(null);
    expect(await service.checkSlugAvailability('status')).toMatchObject({ available: false });

    prisma.tenant.findUnique.mockResolvedValue({ id: BigInt(7) });
    expect(await service.checkSlugAvailability('demo', BigInt(7))).toMatchObject({ available: true });
    expect(await service.checkSlugAvailability('demo', BigInt(8))).toMatchObject({ available: false });

    prisma.tenant.findUnique.mockResolvedValue(null);
    expect(await service.checkSlugAvailability('dr-jane')).toMatchObject({ available: true });
  });
});
