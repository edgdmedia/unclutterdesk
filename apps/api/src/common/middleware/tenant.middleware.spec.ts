import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import { TenantMiddleware, type TenantRequest } from './tenant.middleware';

function makeMiddleware() {
  const prisma = {
    tenant: {
      findUnique: vi.fn(),
    },
  } as any;
  return { middleware: new TenantMiddleware(prisma), prisma };
}

describe('TenantMiddleware', () => {
  it('resolves a localhost subdomain host to the tenant slug', async () => {
    const { middleware, prisma } = makeMiddleware();
    prisma.tenant.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 7n, slug: 'demo' });

    const req = {
      path: '/v1/consult/public/therapists',
      headers: { host: 'demo.localhost:5173' },
    } as unknown as TenantRequest;
    const next = vi.fn() as unknown as NextFunction;

    await middleware.use(req, {} as Response, next);

    expect(prisma.tenant.findUnique).toHaveBeenNthCalledWith(2, {
      where: { slug: 'demo' },
    });
    expect(req.tenantId).toBe(7n);
    expect(next).toHaveBeenCalled();
  });
});
