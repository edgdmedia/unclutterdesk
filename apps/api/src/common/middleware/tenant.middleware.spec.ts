import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import { TenantMiddleware, type TenantRequest } from './tenant.middleware';

function makeMiddleware() {
  const prisma = {
    tenant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  } as any;
  return { middleware: new TenantMiddleware(prisma), prisma };
}

describe('TenantMiddleware', () => {
  it('resolves a localhost subdomain host to the tenant slug', async () => {
    const { middleware, prisma } = makeMiddleware();
    prisma.tenant.findFirst.mockResolvedValueOnce(null);
    prisma.tenant.findUnique.mockResolvedValueOnce({ id: 7n, slug: 'demo' });

    const req = {
      path: '/v1/consult/public/therapists',
      headers: { host: 'demo.localhost:5173' },
    } as unknown as TenantRequest;
    const next = vi.fn() as unknown as NextFunction;

    await middleware.use(req, {} as Response, next);

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { slug: 'demo' },
    });
    expect(req.tenantId).toBe(7n);
    expect(next).toHaveBeenCalled();
  });

  /*
   * Browsers reach the API at api.unclutterdesk.com, so for them the header is
   * the only thing naming the practice. Public booking calls used to go
   * without it and every one of them 404'd.
   */
  describe('the X-Tenant-Slug header', () => {
    const run = async (headerValue: string, prismaSetup: (p: any) => void) => {
      const { middleware, prisma } = makeMiddleware();
      prismaSetup(prisma);
      const req = {
        path: '/v1/consult/public/services',
        headers: { host: 'api.unclutterdesk.com', 'x-tenant-slug': headerValue },
      } as unknown as TenantRequest;
      await middleware.use(req, {} as Response, vi.fn() as unknown as NextFunction);
      return { req, prisma };
    };

    it('resolves a practice slug', async () => {
      const { req } = await run('Calm-Harbor', (p) => p.tenant.findUnique.mockResolvedValue({ id: 4n }));
      expect(req.tenantId).toBe(4n);
    });

    it('resolves a practice on its own verified domain', async () => {
      const { req, prisma } = await run('book.calmharbor.ng', (p) => {
        p.tenant.findUnique.mockResolvedValue(null);
        p.tenant.findFirst.mockResolvedValue({ id: 4n });
      });
      expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
        where: { customDomain: 'book.calmharbor.ng', customDomainStatus: 'ACTIVE' },
      });
      expect(req.tenantId).toBe(4n);
    });

    it('does not treat an unknown value as a practice', async () => {
      const { req } = await run('app-unclutterdesk.pages.dev', (p) => {
        p.tenant.findUnique.mockResolvedValue(null);
        p.tenant.findFirst.mockResolvedValue(null);
      });
      expect(req.tenantId).toBeUndefined();
    });
  });

  it('ignores a custom domain on the Host until it is verified', async () => {
    const { middleware, prisma } = makeMiddleware();
    prisma.tenant.findFirst.mockResolvedValue(null);
    const req = { path: '/v1/consult/public/services', headers: { host: 'book.calmharbor.ng' } } as unknown as TenantRequest;
    await middleware.use(req, {} as Response, vi.fn() as unknown as NextFunction);
    expect(prisma.tenant.findFirst.mock.calls[0][0].where.customDomainStatus).toBe('ACTIVE');
  });
});
