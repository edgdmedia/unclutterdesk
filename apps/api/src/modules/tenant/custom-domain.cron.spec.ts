import { describe, expect, it, vi } from 'vitest';
import { TENANT_ROOT_DOMAIN } from '../../common/origins';
import { CustomDomainCron } from './custom-domain.cron';

function deps() {
  const prisma = {
    tenant: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
  } as any;
  const cf = {
    configured: () => true,
    getStatus: vi.fn(),
    listHostnames: vi.fn().mockResolvedValue([]),
    deleteHostname: vi.fn().mockResolvedValue(undefined),
    removeRoute: vi.fn().mockResolvedValue(undefined),
    ensureRoutes: vi.fn().mockResolvedValue([]),
  } as any;
  const tenantService = { provisionCustomDomain: vi.fn().mockResolvedValue(null) } as any;
  return { prisma, cf, tenantService, cron: new CustomDomainCron(prisma, cf, tenantService) };
}

describe('CustomDomainCron', () => {
  it('does nothing while Cloudflare is unconfigured', async () => {
    const { prisma, cf, tenantService } = deps();
    cf.configured = () => false;
    const cron = new CustomDomainCron(prisma, cf, tenantService);
    await cron.tick();
    expect(prisma.tenant.findMany).not.toHaveBeenCalled();
  });

  it('promotes a domain once Cloudflare says hostname and certificate are active', async () => {
    const { prisma, cf, tenantService, cron } = deps();
    prisma.tenant.findMany
      .mockResolvedValueOnce([{ id: BigInt(1), customDomain: 'book.acme.ng', customHostnameId: 'cf1' }])
      .mockResolvedValueOnce([]);
    cf.getStatus.mockResolvedValue({ status: 'active', sslStatus: 'active' });

    await cron.tick();
    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BigInt(1) }, data: expect.objectContaining({ customDomainStatus: 'ACTIVE' }) }),
    );
  });

  it('leaves a still-pending domain alone', async () => {
    const { prisma, cf, tenantService, cron } = deps();
    prisma.tenant.findMany
      .mockResolvedValueOnce([{ id: BigInt(1), customDomain: 'book.acme.ng', customHostnameId: 'cf1' }])
      .mockResolvedValueOnce([]);
    cf.getStatus.mockResolvedValue({ status: 'active', sslStatus: 'initializing' });

    await cron.tick();
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('retries provisioning for a domain that never got a hostname object', async () => {
    const { prisma, cf, tenantService, cron } = deps();
    prisma.tenant.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: BigInt(2), customDomain: 'book.acme.ng' }]);

    await cron.tick();
    expect(tenantService.provisionCustomDomain).toHaveBeenCalledWith(
      BigInt(2), 'book.acme.ng', { customDomain: null, customHostnameId: null },
    );
  });

  it('sweeps hostnames no tenant claims by name', async () => {
    const { prisma, cf, tenantService, cron } = deps();
    cf.listHostnames.mockResolvedValue([
      { id: 'cf-kept', hostname: 'keep.acme.ng' },
      { id: 'cf-orphan', hostname: 'gone.acme.ng' },
    ]);
    prisma.tenant.findMany.mockImplementation((args: any) =>
      args.where?.customDomain?.in
        ? Promise.resolve([{ customDomain: 'keep.acme.ng' }])
        : Promise.resolve([]),
    );

    await cron.tick();
    expect(cf.deleteHostname).toHaveBeenCalledWith('cf-orphan');
    expect(cf.removeRoute).toHaveBeenCalledWith('gone.acme.ng');
    expect(cf.deleteHostname).not.toHaveBeenCalledWith('cf-kept');
  });

  it('survives a Cloudflare outage without throwing', async () => {
    const { prisma, cf, tenantService, cron } = deps();
    cf.listHostnames.mockRejectedValue(new Error('boom'));
    cf.getStatus.mockRejectedValue(new Error('boom'));
    prisma.tenant.findMany
      .mockResolvedValueOnce([{ id: BigInt(1), customDomain: 'book.acme.ng', customHostnameId: 'cf1' }])
      .mockResolvedValueOnce([]);

    await expect(cron.tick()).resolves.toBeUndefined();
  });

  describe('Worker routes', () => {
    it('restores the route of every provisioned domain and the practice subdomains', async () => {
      const { prisma, cf, cron } = deps();
      prisma.tenant.findMany.mockImplementation(async (args: any) =>
        args?.where?.customHostnameId?.not === null && args?.where?.customDomain?.not === null && !args?.where?.customDomainStatus
          ? [{ customDomain: 'consult.unclutter.com.ng' }, { customDomain: 'book.acme.ng' }]
          : [],
      );
      cf.ensureRoutes.mockResolvedValue(['consult.unclutter.com.ng/*']);

      await cron.tick();
      expect(cf.ensureRoutes).toHaveBeenCalledWith([
        `*.${TENANT_ROOT_DOMAIN}/*`,
        'consult.unclutter.com.ng/*',
        'book.acme.ng/*',
      ]);
    });

    it('keeps the subdomain route even with no custom domains', async () => {
      const { cf, cron } = deps();
      await cron.tick();
      expect(cf.ensureRoutes).toHaveBeenCalledWith([`*.${TENANT_ROOT_DOMAIN}/*`]);
    });

    it('survives Cloudflare refusing the route check', async () => {
      const { cf, cron } = deps();
      cf.ensureRoutes.mockRejectedValue(new Error('cf down'));
      await expect(cron.tick()).resolves.toBeUndefined();
    });
  });
});
