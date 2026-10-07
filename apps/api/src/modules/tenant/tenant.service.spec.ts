import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { TenantService, publicTenantFields } from './tenant.service';

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
      OR: [{ slug: 'dr-smith' }, { customDomain: 'dr-smith', customDomainStatus: 'ACTIVE' }],
    });
  });

  test('looks a custom domain up as itself', async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findFirst.mockResolvedValue({ isActive: true });
    const service = new TenantService(prisma, notificationsMock());

    await service.getPublicTenantExistence('book.calmpractice.ng');
    expect(prisma.tenant.findFirst.mock.calls[0][0].where).toEqual({
      OR: [{ slug: 'book.calmpractice.ng' }, { customDomain: 'book.calmpractice.ng', customDomainStatus: 'ACTIVE' }],
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
      { customDomain: 'booking.drjane.com', customDomainStatus: 'ACTIVE' },
    ]);
  });

  // A domain someone typed into Brand settings but never pointed at us must
  // not make the edge router serve that host as the practice.
  test('only counts a custom domain once it is verified', async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findFirst.mockResolvedValue(null);
    const service = new TenantService(prisma, notificationsMock());

    await service.getPublicTenantExistence('book.pending.ng');
    const domainClause = prisma.tenant.findFirst.mock.calls[0][0].where.OR[1];
    expect(domainClause.customDomainStatus).toBe('ACTIVE');
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

describe('TenantService.getPublicTenantInfo', () => {
  // The booking page brands itself from this. An unverified domain must not
  // resolve to a practice, the same rule the middleware and CORS apply.
  test('only resolves a custom domain once it is verified', async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findFirst.mockResolvedValue(null);
    const service = new TenantService(prisma, notificationsMock());

    await service.getPublicTenantInfo('Book.Pending.ng').catch(() => undefined);
    expect(prisma.tenant.findFirst.mock.calls[0][0].where.OR).toEqual([
      { slug: 'book.pending.ng' },
      { customDomain: 'book.pending.ng', customDomainStatus: 'ACTIVE' },
    ]);
  });
});

describe('publicTenantFields', () => {
  test('keeps branding and drops billing codes and internal flags', () => {
    const row = {
      id: 9n,
      name: 'Calm Harbor',
      slug: 'calm-harbor',
      primaryColor: '#123456',
      paystackCustomerCode: 'CUS_secret',
      paystackSubscriptionCode: 'SUB_secret',
      notificationChannels: { email: true },
      ecosystemIntegrationEnabled: true,
      manualPaymentDetails: { accountNumber: '0123456789' },
    };
    const out = publicTenantFields(row);
    expect(out).toEqual({ id: '9', name: 'Calm Harbor', slug: 'calm-harbor', primaryColor: '#123456' });
  });
});

/** SET-13: saving a domain provisions Cloudflare; every shape is covered. */
describe('TenantService SET-13 custom domain provisioning', () => {
  function cfMock() {
    return {
      configured: () => true,
      createHostname: vi.fn().mockResolvedValue({ id: 'cf1', status: 'pending', sslStatus: 'pending', cnameTarget: 'tag.my.cloudflare.net', verificationRecords: [] }),
      ensureRoute: vi.fn().mockResolvedValue(undefined),
      deleteHostname: vi.fn().mockResolvedValue(undefined),
      removeRoute: vi.fn().mockResolvedValue(undefined),
      getVerification: vi.fn(),
      getStatus: vi.fn(),
    } as any;
  }

  function serviceWith(prisma: any, cf: any) {
    return new TenantService(prisma, notificationsMock(), undefined, cf);
  }

  test('a new domain creates the hostname and the worker route', async () => {
    const prisma = createPrismaMock();
    const cf = cfMock();
    prisma.tenant.findUnique.mockResolvedValue({ id: BigInt(1), subscriptionTier: 'PRO', customDomain: null, customHostnameId: null });
    prisma.tenant.update.mockResolvedValue({ id: BigInt(1), customDomain: 'book.acme.ng' });

    await serviceWith(prisma, cf).updateTenantBrand(BigInt(1), { customDomain: 'book.acme.ng' });

    expect(cf.createHostname).toHaveBeenCalledWith('book.acme.ng');
    expect(cf.ensureRoute).toHaveBeenCalledWith('book.acme.ng');
    const last = prisma.tenant.update.mock.calls.at(-1)[0];
    expect(last.data).toEqual({ customHostnameId: 'cf1', customHostnameError: null });
  });

  test('a changed domain deletes the old hostname and route first', async () => {
    const prisma = createPrismaMock();
    const cf = cfMock();
    prisma.tenant.findUnique.mockResolvedValue({ id: BigInt(1), subscriptionTier: 'PRO', customDomain: 'book.old.ng', customHostnameId: 'cf0' });
    prisma.tenant.update.mockResolvedValue({ id: BigInt(1), customDomain: 'book.acme.ng' });

    await serviceWith(prisma, cf).updateTenantBrand(BigInt(1), { customDomain: 'book.acme.ng' });

    expect(cf.deleteHostname).toHaveBeenCalledWith('cf0');
    expect(cf.removeRoute).toHaveBeenCalledWith('book.old.ng');
    expect(cf.createHostname).toHaveBeenCalledWith('book.acme.ng');
  });

  test('re-saving the same domain leaves Cloudflare alone', async () => {
    const prisma = createPrismaMock();
    const cf = cfMock();
    prisma.tenant.findUnique.mockResolvedValue({ id: BigInt(1), subscriptionTier: 'PRO', customDomain: 'book.acme.ng', customHostnameId: 'cf1' });
    prisma.tenant.update.mockResolvedValue({ id: BigInt(1), customDomain: 'book.acme.ng' });

    await serviceWith(prisma, cf).updateTenantBrand(BigInt(1), { customDomain: 'book.acme.ng' });

    expect(cf.deleteHostname).not.toHaveBeenCalled();
    expect(cf.createHostname).not.toHaveBeenCalled();
    expect(prisma.tenant.update).toHaveBeenCalledTimes(1);
  });

  test('a provisioning failure is stored, never thrown at the practice', async () => {
    const prisma = createPrismaMock();
    const cf = cfMock();
    cf.createHostname.mockRejectedValue(new Error('Cloudflare 12021: quota reached'));
    prisma.tenant.findUnique.mockResolvedValue({ id: BigInt(1), subscriptionTier: 'PRO', customDomain: null, customHostnameId: null });
    prisma.tenant.update.mockResolvedValue({ id: BigInt(1), customDomain: 'book.acme.ng' });

    await expect(serviceWith(prisma, cf).updateTenantBrand(BigInt(1), { customDomain: 'book.acme.ng' })).resolves.toBeTruthy();
    const last = prisma.tenant.update.mock.calls.at(-1)[0];
    expect(last.data.customHostnameId).toBeNull();
    expect(last.data.customHostnameError).toMatch(/12021/);
  });

  test('with Cloudflare unconfigured nothing is called', async () => {
    const prisma = createPrismaMock();
    const cf = cfMock();
    cf.configured = () => false;
    prisma.tenant.findUnique.mockResolvedValue({ id: BigInt(1), subscriptionTier: 'PRO', customDomain: null, customHostnameId: null });
    prisma.tenant.update.mockResolvedValue({ id: BigInt(1), customDomain: 'book.acme.ng' });

    await serviceWith(prisma, cf).updateTenantBrand(BigInt(1), { customDomain: 'book.acme.ng' });
    expect(cf.createHostname).not.toHaveBeenCalled();
    expect(prisma.tenant.update).toHaveBeenCalledTimes(1);
  });

  test('the status endpoint merges stored state with live Cloudflare records', async () => {
    const prisma = createPrismaMock();
    const cf = cfMock();
    cf.getVerification.mockResolvedValue({
      id: 'cf1', status: 'pending', sslStatus: 'initializing',
      cnameTarget: 'tag.my.cloudflare.net',
      verificationRecords: [{ name: 'consult.unclutter.com.ng', type: 'CNAME', data: 'x' }],
    });
    prisma.tenant.findUnique.mockResolvedValue({
      id: BigInt(1), customDomain: 'consult.unclutter.com.ng', customDomainStatus: 'PENDING',
      customHostnameId: 'cf1', customHostnameError: null,
    });

    const service = serviceWith(prisma, cf);
    (service as any).checkPublishedRecord = vi.fn().mockResolvedValue('missing');
    const out = await service.getCustomDomainStatus(BigInt(1));
    expect((service as any).checkPublishedRecord).toHaveBeenCalledTimes(2);
    expect(out).toMatchObject({
      hostname: 'consult.unclutter.com.ng',
      status: 'PENDING',
      cnameTarget: 'tag.my.cloudflare.net',
      cfStatus: { status: 'pending', sslStatus: 'initializing' },
    });
    // the routing CNAME row comes first, then Cloudflare's records — each
    // carries a DNS-verified state for the panel's status column
    expect(out.records[0]).toMatchObject({ type: 'CNAME', name: 'consult.unclutter.com.ng', value: 'tag.my.cloudflare.net', state: 'missing' });
    expect(out.records[1]).toMatchObject({ type: 'CNAME', name: 'consult.unclutter.com.ng', value: 'x', state: 'missing' });
    expect(out.records).toHaveLength(2);
  });

  test('verify promotes on Cloudflare verdict without touching public DNS', async () => {
    const prisma = createPrismaMock();
    const cf = cfMock();
    cf.getVerification.mockResolvedValue({ id: 'cf1', status: 'active', sslStatus: 'active', cnameTarget: null, verificationRecords: [] });
    prisma.tenant.findUnique.mockResolvedValue({ id: BigInt(1), customDomain: 'book.acme.ng', customHostnameId: 'cf1' });
    prisma.tenant.update.mockResolvedValue({ id: BigInt(1), customDomain: 'book.acme.ng', customDomainStatus: 'ACTIVE' });

    const out = await serviceWith(prisma, cf).verifyCustomDomain(BigInt(1));
    expect(out.customDomainStatus).toBe('ACTIVE');
    expect(prisma.tenant.update).toHaveBeenCalled();
  });

  test('verify explains what is still missing while the hostname waits', async () => {
    const prisma = createPrismaMock();
    const cf = cfMock();
    cf.getVerification.mockResolvedValue({ id: 'cf1', status: 'pending', sslStatus: 'pending', cnameTarget: 'tag.my.cloudflare.net', verificationRecords: [] });
    prisma.tenant.findUnique.mockResolvedValue({ id: BigInt(1), customDomain: 'book.acme.ng', customHostnameId: 'cf1' });
    prisma.tenant.update.mockResolvedValue({ id: BigInt(1) });

    await expect(serviceWith(prisma, cf).verifyCustomDomain(BigInt(1)))
      .rejects.toThrow(/tag\.my\.cloudflare\.net/);
  });
});
