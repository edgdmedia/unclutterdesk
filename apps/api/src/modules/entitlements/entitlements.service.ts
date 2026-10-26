import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { countMonthlyBookings } from '../consult/booking-limits';
import { EntitlementError } from './entitlement.error';
import {
  PLAN_SELECT,
  TIER_NAMES,
  effectiveTier,
  nextTier,
  practiceEntitlements,
  profileEntitlementsFromTiers,
  requiredTierFor,
  requiredTierForProfile,
  type PracticeEntitlements,
  type PracticeFeature,
  type ProfileEntitlements,
  type ProfileFeature,
} from './entitlements';

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async forPractice(tenantId: bigint): Promise<PracticeEntitlements> {
    return practiceEntitlements(await this.load(tenantId));
  }

  /** Throws a 402 `EntitlementError` when the practice's plan does not include `feature`. */
  async assertPractice(tenantId: bigint, feature: PracticeFeature, message?: string): Promise<void> {
    if (!(await this.forPractice(tenantId))[feature]) {
      throw new EntitlementError(feature, requiredTierFor(feature), message);
    }
  }

  /**
   * Profile entitlements for a person: the best effective plan among the
   * practices where they are an **active** OWNER or THERAPIST. ADMIN,
   * RECEPTIONIST and CLIENT memberships never count, nor do inactive or
   * closing practices. No qualifying membership → FREE.
   */
  async forProfile(userId: bigint): Promise<ProfileEntitlements> {
    const memberships = await this.prisma.profile.findMany({
      where: {
        userId,
        status: 'active',
        role: { in: ['OWNER', 'THERAPIST'] },
        tenant: { isActive: true, closureRequestedAt: null },
      },
      select: { tenant: { select: PLAN_SELECT } },
    });
    return profileEntitlementsFromTiers(memberships.map((m) => effectiveTier(m.tenant)));
  }

  async assertProfile(userId: bigint, feature: ProfileFeature, message?: string): Promise<void> {
    if (!(await this.forProfile(userId))[feature]) {
      throw new EntitlementError(feature, requiredTierForProfile(feature), message, 'profile');
    }
  }

  /** What `GET /v1/tenant/entitlements` returns: the plan, what it includes and how much of the month's bookings are used. */
  async summary(tenantId: bigint) {
    const tenant = await this.load(tenantId);
    const tier = effectiveTier(tenant);
    const entitlements = practiceEntitlements(tenant);
    const bookingsThisMonth = entitlements.monthlyBookingLimit === null ? null : await countMonthlyBookings(this.prisma, tenantId);
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
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: PLAN_SELECT });
    if (!tenant) throw new NotFoundException('Practice tenant not found');
    return tenant;
  }
}
