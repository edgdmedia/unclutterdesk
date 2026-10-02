import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DiscountService } from './discount.service';

/** SET-09: turning a code off was a one-way door. Editing and deleting were absent. */
const TENANT = 1n;

function make() {
  const prisma: any = {
    discountCode: {
      update: vi.fn().mockImplementation(async ({ data }: any) => ({ id: 7n, tenantId: TENANT, code: 'SAVE10', usedCount: 1, ...data })),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn(),
    },
  };
  return { prisma, service: new DiscountService(prisma) };
}

describe('discount management', () => {
  it('re-activates a code through the update', async () => {
    const { prisma, service } = make();
    await service.updateDiscount(TENANT, 7n, { isActive: true });
    expect(prisma.discountCode.update.mock.calls[0][0]).toMatchObject({
      where: { id: 7n, tenantId: TENANT },
      data: { isActive: true },
    });
  });

  it('edits one field without blanking the others', async () => {
    const { prisma, service } = make();
    await service.updateDiscount(TENANT, 7n, { label: 'Friends' });
    expect(prisma.discountCode.update.mock.calls[0][0].data).toEqual({ label: 'Friends' });
  });

  it('edits the amount and the limits together', async () => {
    const { prisma, service } = make();
    await service.updateDiscount(TENANT, 7n, { maxUses: 20, discountType: 'PERCENT', discountPercent: 15 });
    expect(prisma.discountCode.update.mock.calls[0][0].data).toMatchObject({ maxUses: 20, discountType: 'PERCENT', discountPercent: 15 });
  });

  it('deletes the row, scoped to the practice', async () => {
    const { prisma, service } = make();
    expect(await service.deleteDiscount(TENANT, 7n)).toEqual({ deleted: true });
    expect(prisma.discountCode.deleteMany.mock.calls[0][0].where).toEqual({ id: 7n, tenantId: TENANT });
  });

  it('says not found when the code is not this practice’s', async () => {
    const { prisma, service } = make();
    prisma.discountCode.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.deleteDiscount(TENANT, 99n)).rejects.toBeInstanceOf(NotFoundException);
  });
});
