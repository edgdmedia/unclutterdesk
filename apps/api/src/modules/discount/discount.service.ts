import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class DiscountService {
  constructor(private readonly prisma: PrismaService) {}

  async listDiscounts(tenantId: bigint) {
    const discounts = await this.prisma.discountCode.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return discounts.map(d => ({
      id: d.id.toString(),
      code: d.code,
      label: d.label,
      discountType: d.discountType,
      discountPercent: d.discountPercent,
      discountAmountKobo: d.discountAmountKobo?.toString(),
      maxUses: d.maxUses,
      usedCount: d.usedCount,
      expiresAt: d.expiresAt?.toISOString(),
      isActive: d.isActive,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  async createDiscount(tenantId: bigint, dto: {
    code: string;
    label?: string;
    discountType: 'PERCENT' | 'FIXED';
    discountPercent?: number;
    discountAmountKobo?: bigint | string | number;
    maxUses?: number;
    expiresAt?: string;
  }) {
    if (dto.discountType === 'PERCENT' && !dto.discountPercent) throw new BadRequestException('Percent is required for PERCENT type');
    if (dto.discountType === 'FIXED' && !dto.discountAmountKobo) throw new BadRequestException('Amount is required for FIXED type');

    const amountKobo = dto.discountAmountKobo ? BigInt(dto.discountAmountKobo) : null;

    const discount = await this.prisma.discountCode.create({
      data: {
        tenantId,
        code: dto.code.toUpperCase().trim(),
        label: dto.label,
        discountType: dto.discountType,
        discountPercent: dto.discountPercent,
        discountAmountKobo: amountKobo,
        maxUses: dto.maxUses,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    return { ...discount, id: discount.id.toString(), discountAmountKobo: discount.discountAmountKobo?.toString() };
  }

  async updateDiscount(tenantId: bigint, id: bigint, dto: {
    label?: string | null;
    maxUses?: number | null;
    expiresAt?: string | null;
    isActive?: boolean;
    discountType?: 'PERCENT' | 'FIXED';
    discountPercent?: number;
    discountAmountKobo?: string;
  }) {
    // SET-09: only the fields the caller sent change. The old version wrote
    // label/maxUses/expiresAt unconditionally, so editing one blanked the rest.
    const discount = await this.prisma.discountCode.update({
      where: { id, tenantId },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.maxUses !== undefined ? { maxUses: dto.maxUses } : {}),
        ...(dto.expiresAt !== undefined ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.discountType !== undefined ? { discountType: dto.discountType } : {}),
        ...(dto.discountPercent !== undefined ? { discountPercent: dto.discountPercent } : {}),
        ...(dto.discountAmountKobo !== undefined ? { discountAmountKobo: BigInt(dto.discountAmountKobo) } : {}),
      },
    });
    return { ...discount, id: discount.id.toString(), discountAmountKobo: discount.discountAmountKobo?.toString() };
  }

  /** SET-09: remove a code for good. Past bookings keep the code text they used. */
  async deleteDiscount(tenantId: bigint, id: bigint) {
    const done = await this.prisma.discountCode.deleteMany({ where: { id, tenantId } });
    if (done.count === 0) throw new NotFoundException('Discount code not found');
    return { deleted: true };
  }

  async deactivateDiscount(tenantId: bigint, id: bigint) {
    const discount = await this.prisma.discountCode.update({
      where: { id, tenantId },
      data: { isActive: false },
    });
    return { ...discount, id: discount.id.toString(), discountAmountKobo: discount.discountAmountKobo?.toString() };
  }

  async validateDiscount(tenantId: bigint, code: string, priceKobo: bigint) {
    const dc = await this.prisma.discountCode.findUnique({ where: { tenantId_code: { tenantId, code: code.toUpperCase().trim() } } });
    if (!dc || !dc.isActive) throw new NotFoundException('Invalid discount code');
    if (dc.expiresAt && dc.expiresAt < new Date()) throw new BadRequestException('This code has expired');
    if (dc.maxUses && dc.usedCount >= dc.maxUses) throw new BadRequestException('Code fully redeemed');

    let discounted = Number(priceKobo);
    if (dc.discountType === 'PERCENT') {
      discounted = Number(priceKobo) * (1 - (dc.discountPercent || 0) / 100);
    } else {
      discounted = Math.max(0, Number(priceKobo) - Number(dc.discountAmountKobo || 0));
    }

    const finalKobo = Math.round(discounted);
    const amountSavedKobo = Math.max(0, Number(priceKobo) - finalKobo);

    return {
      code: dc.code,
      label: dc.label,
      discountType: dc.discountType,
      discountPercent: dc.discountPercent,
      discountAmountKobo: dc.discountAmountKobo?.toString() ?? null,
      originalKobo: priceKobo.toString(),
      finalKobo: finalKobo.toString(),
      amountSavedKobo: amountSavedKobo.toString(),
    };
  }
}
