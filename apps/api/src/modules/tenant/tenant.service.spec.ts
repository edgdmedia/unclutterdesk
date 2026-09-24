import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, test, vi } from 'vitest';
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

/** The invite path emails the invitee; nothing else in here sends anything. */
function notificationsMock() {
  return { sendEmail: vi.fn().mockResolvedValue({ success: true }) } as any;
}

describe('TenantService custom domain flow', () => {
  test('rejects invalid custom domain values', async () => {
    const prisma = createPrismaMock();
    const service = new TenantService(prisma, notificationsMock());

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
    const service = new TenantService(prisma, notificationsMock());

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

});

/**
 * Verification used to mark any domain ACTIVE on request. An active domain
 * becomes the practice's address in client emails and is trusted by CORS, so
 * it must be proven to reach us first.
 */
describe('TenantService custom domain verification', () => {
  const TARGET = 'customers.unclutterdesk.com';

  function setup({ cname = [TARGET + '.'], https = true, target = TARGET as string | null } = {}) {
    if (target) vi.stubEnv('CUSTOM_DOMAIN_TARGET', target);
    else vi.stubEnv('CUSTOM_DOMAIN_TARGET', '');
    const prisma = createPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({ id: BigInt(1), customDomain: 'Booking.Example.com' });
    prisma.tenant.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: BigInt(1), customDomain: data.customDomain, customDomainStatus: data.customDomainStatus }),
    );
    const service = new TenantService(prisma, notificationsMock()) as any;
    vi.spyOn(service, 'lookupCname').mockResolvedValue(cname);
    vi.spyOn(service, 'servesHttps').mockResolvedValue(https);
    return { prisma, service: service as TenantService };
  }

  const statusWritten = (prisma: any) => prisma.tenant.update.mock.calls.map((c: any) => c[0].data.customDomainStatus);

  afterEach(() => vi.unstubAllEnvs());

  test('activates a domain whose CNAME points at us and which serves HTTPS', async () => {
    const { service } = setup();
    await expect(service.verifyCustomDomain(BigInt(1))).resolves.toEqual({
      id: '1',
      customDomain: 'booking.example.com',
      customDomainStatus: 'ACTIVE',
    });
  });

  test('marks a domain that does not point at us as FAILED, naming the record to add', async () => {
    const { service, prisma } = setup({ cname: [] });
    await expect(service.verifyCustomDomain(BigInt(1))).rejects.toThrow(TARGET);
    expect(statusWritten(prisma)).toEqual(['FAILED']);
  });

  test('keeps a domain PENDING while its certificate is issued', async () => {
    const { service, prisma } = setup({ https: false });
    await expect(service.verifyCustomDomain(BigInt(1))).rejects.toThrow(/certificate/);
    expect(statusWritten(prisma)).toEqual(['PENDING']);
  });

  test('activates nothing while custom domains are not configured on the platform', async () => {
    const { service, prisma } = setup({ target: null });
    await expect(service.verifyCustomDomain(BigInt(1))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });
});

describe('TenantService staff role guard', () => {
  test('rejects role changes from therapists', async () => {
    const prisma = createPrismaMock();
    prisma.profile.findFirst.mockResolvedValueOnce({ id: BigInt(2), role: 'THERAPIST' });
    const service = new TenantService(prisma, notificationsMock());

    await expect(service.updateStaffRole(BigInt(1), BigInt(2), BigInt(3), 'OWNER')).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('rejects admin assigning the owner role', async () => {
    const prisma = createPrismaMock();
    prisma.profile.findFirst.mockResolvedValueOnce({ id: BigInt(5), role: 'ADMIN' });
    const service = new TenantService(prisma, notificationsMock());

    await expect(service.updateStaffRole(BigInt(1), BigInt(5), BigInt(2), 'OWNER')).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('allows admin to assign a staff role within the tenant', async () => {
    const prisma = createPrismaMock();
    prisma.profile.findFirst.mockResolvedValueOnce({ id: BigInt(5), role: 'ADMIN' });
    prisma.profile.findFirst.mockResolvedValueOnce({ id: BigInt(2), role: 'RECEPTIONIST' });
    prisma.profile.update.mockResolvedValue({ id: BigInt(2), role: 'THERAPIST' });
    const service = new TenantService(prisma, notificationsMock());

    const result = await service.updateStaffRole(BigInt(1), BigInt(5), BigInt(2), 'THERAPIST');
    expect(result).toEqual({ id: '2', role: 'THERAPIST' });
  });

  test('rejects targets outside the tenant or client profiles', async () => {
    const prisma = createPrismaMock();
    prisma.profile.findFirst.mockResolvedValueOnce({ id: BigInt(1), role: 'OWNER' });
    prisma.profile.findFirst.mockResolvedValueOnce(null);
    const service = new TenantService(prisma, notificationsMock());

    await expect(service.updateStaffRole(BigInt(1), BigInt(1), BigInt(99), 'THERAPIST')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TenantService.getPublicTenantExistence', () => {
  // The edge router probes with the host it is serving. This used to miss, so
  // every practice subdomain showed the 404 page.
  test('finds a practice from its full subdomain host', async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findFirst.mockResolvedValue({ isActive: true });
    const service = new TenantService(prisma, notificationsMock());

    await expect(service.getPublicTenantExistence('Dr-Smith.unclutterdesk.com')).resolves.toEqual({ exists: true, active: true });
    expect(prisma.tenant.findFirst.mock.calls[0][0].where).toEqual({
      OR: [{ slug: 'dr-smith' }, { customDomain: 'dr-smith' }],
    });
  });

  test('looks a custom domain up as itself', async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findFirst.mockResolvedValue({ isActive: true });
    const service = new TenantService(prisma, notificationsMock());

    await service.getPublicTenantExistence('book.calmpractice.ng');
    expect(prisma.tenant.findFirst.mock.calls[0][0].where).toEqual({
      OR: [{ slug: 'book.calmpractice.ng' }, { customDomain: 'book.calmpractice.ng' }],
    });
  });

  test('reports an active practice as existing and active', async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findFirst.mockResolvedValue({ isActive: true });
    const service = new TenantService(prisma, notificationsMock());

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
    const service = new TenantService(prisma, notificationsMock());

    await expect(service.getPublicTenantExistence('paused')).resolves.toEqual({
      exists: true,
      active: false,
    });
  });

  test('does not filter on isActive when looking the practice up', async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findFirst.mockResolvedValue({ isActive: false });
    const service = new TenantService(prisma, notificationsMock());

    await service.getPublicTenantExistence('paused');
    expect(prisma.tenant.findFirst.mock.calls[0][0].where).not.toHaveProperty('isActive');
  });

  test('reports a missing practice as not existing', async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findFirst.mockResolvedValue(null);
    const service = new TenantService(prisma, notificationsMock());

    await expect(service.getPublicTenantExistence('nope')).resolves.toEqual({
      exists: false,
      active: false,
    });
  });

  test('matches on slug or custom domain, case-insensitively', async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findFirst.mockResolvedValue({ isActive: true });
    const service = new TenantService(prisma, notificationsMock());

    await service.getPublicTenantExistence('  Booking.DrJane.com  ');
    expect(prisma.tenant.findFirst.mock.calls[0][0].where.OR).toEqual([
      { slug: 'booking.drjane.com' },
      { customDomain: 'booking.drjane.com' },
    ]);
  });

  test('returns only existence flags, never practice detail', async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findFirst.mockResolvedValue({ isActive: true });
    const service = new TenantService(prisma, notificationsMock());

    const result = await service.getPublicTenantExistence('dr-smith');
    expect(Object.keys(result).sort()).toEqual(['active', 'exists']);
    expect(prisma.tenant.findFirst.mock.calls[0][0].select).toEqual({ isActive: true });
  });
});
