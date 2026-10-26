import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EntitlementError } from './entitlement.error';
import {
  TIER_NAMES,
  effectiveTier,
  entitlementsFor,
  hasEntitlement,
  nextTier,
  requiredTierFor,
  type EntitlementKey,
  type Entitlements,
} from './entitlements';

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async forTenant(tenantId: bigint): Promise<Entitlements> {
    return entitlementsFor(await this.load(tenantId));
  }

  /** Throws a 402 `EntitlementError` when the practice's plan does not include `key`. */
  async assert(tenantId: bigint, key: EntitlementKey, message?: string): Promise<void> {
    const entitlements = await this.forTenant(tenantId);
    if (!hasEntitlement(entitlements, key)) {
      throw new EntitlementError(key, requiredTierFor(key), message);
    }
  }

  /** What `GET /v1/tenant/entitlements` returns: the plan, what it includes and how much of the month's bookings are used. */
  async summary(tenantId: bigint) {
    const tenant = await this.load(tenantId);
    const tier = effectiveTier(tenant);
    const entitlements = entitlementsFor(tenant);
    let bookingsThisMonth: number | null = null;
    if (entitlements.monthlyBookingLimit !== null) {
      bookingsThisMonth = await this.prisma.consultBooking.count({
        where: { tenantId, createdAt: { gte: monthStart() }, status: { not: 'CANCELLED' } },
      });
    }
    const upgradeTo = nextTier(tier);
    return {
      tier,
      tierName: TIER_NAMES[tier],
      upgradeTo,
      upgradeToName: upgradeTo ? TIER_NAMES[upgradeTo] : null,
      entitlements,
      usage: {
        bookingsThisMonth,
        bookingLimitReached:
          entitlements.monthlyBookingLimit !== null && (bookingsThisMonth ?? 0) >= entitlements.monthlyBookingLimit,
      },
    };
  }

  private async load(tenantId: bigint) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subscriptionTier: true, complimentaryUntil: true },
    });
    if (!tenant) throw new NotFoundException('Practice tenant not found');
    return tenant;
  }
}

/** Midnight on the first of this month, server time — the window booking limits count over. */
export function monthStart(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
}
