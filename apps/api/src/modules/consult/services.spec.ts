import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConsultService } from './consult.service';

/**
 * A practice's services, managed after onboarding.
 *
 * Services could only be created, never listed or edited, so repricing meant
 * re-running the onboarding wizard, which created another "Individual
 * Therapy" alongside the old one. Both then showed on the booking page.
 */
const TENANT = 1n;

function stored(over: Record<string, unknown> = {}) {
  return {
    id: 7n,
    tenantId: TENANT,
    title: 'Individual Therapy',
    description: null,
    durationMinutes: 50,
    priceKobo: 3500000n,
    isActive: true,
    ...over,
  };
}

function makeService(existing: ReturnType<typeof stored> | null = stored()) {
  const prisma: any = {
    consultService: {
      findFirst: vi.fn().mockResolvedValue(existing),
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 8n, description: null, ...data })),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...existing, ...data })),
    },
  };
  const service = new ConsultService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any);
  return { service, prisma };
}

describe('ConsultService services', () => {
  it('lists only this practice\'s services, retired ones included', async () => {
    const { service, prisma } = makeService();
    const list = await service.listServices(TENANT);
    expect(prisma.consultService.findMany.mock.calls[0][0].where).toEqual({ tenantId: TENANT });
    expect(list[0]).toMatchObject({ id: '7', priceKobo: '3500000', isActive: true });
  });

  it('reprices a service in place rather than adding another', async () => {
    const { service, prisma } = makeService();
    const updated = await service.updateService(TENANT, 7n, { priceKobo: '4000000' });
    expect(prisma.consultService.create).not.toHaveBeenCalled();
    expect(prisma.consultService.update.mock.calls[0][0].data.priceKobo).toBe(4000000n);
    expect(updated.priceKobo).toBe('4000000');
  });

  // The id comes from the URL; the tenant must come from the session.
  it('cannot edit another practice\'s service', async () => {
    const { service, prisma } = makeService(null);
    await expect(service.updateService(TENANT, 99n, { title: 'Mine now' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.consultService.findFirst.mock.calls[0][0].where).toEqual({ id: 99n, tenantId: TENANT });
    expect(prisma.consultService.update).not.toHaveBeenCalled();
  });

  it('retires a service instead of deleting it', async () => {
    const { service, prisma } = makeService();
    const updated = await service.updateService(TENANT, 7n, { isActive: false });
    expect(updated.isActive).toBe(false);
    expect(prisma.consultService).not.toHaveProperty('delete');
  });

  it.each([
    [{ title: '   ' }, 'name'],
    [{ priceKobo: '-500' }, 'Price'],
    [{ priceKobo: '12.5' }, 'Price'],
    [{ durationMinutes: 0 }, 'Session length'],
    [{ durationMinutes: 1000 }, 'Session length'],
  ])('refuses %o', async (dto, message) => {
    const { service } = makeService();
    const attempt = service.updateService(TENANT, 7n, dto as any);
    await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
    await expect(attempt).rejects.toThrow(message);
  });

  it('will not create a service without a name', async () => {
    const { service, prisma } = makeService();
    await expect(service.createService(TENANT, { title: '' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.consultService.create).not.toHaveBeenCalled();
  });
});
