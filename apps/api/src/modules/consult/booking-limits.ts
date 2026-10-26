import { HttpException, HttpStatus } from '@nestjs/common';
import { entitlementsFor, nextTier, effectiveTier, TIER_NAMES } from '../entitlements/entitlements';
import { monthStart } from '../entitlements/entitlements.service';

type TenantPlan = { subscriptionTier?: string | null; complimentaryUntil?: Date | null } | null | undefined;
type BookingCounter = { consultBooking: { count: (args: any) => Promise<number> } };

/** Bookings this month that count towards the plan's limit (cancelled ones don't). */
export function countMonthlyBookings(prisma: BookingCounter, tenantId: bigint): Promise<number> {
  return prisma.consultBooking.count({
    where: { tenantId, createdAt: { gte: monthStart() }, status: { not: 'CANCELLED' } },
  });
}

/** True when the practice has used up this month's bookings. Always false on unlimited plans. */
export async function monthlyLimitReached(prisma: BookingCounter, tenantId: bigint, tenant: TenantPlan): Promise<boolean> {
  const limit = entitlementsFor(tenant).monthlyBookingLimit;
  if (limit === null) return false;
  return (await countMonthlyBookings(prisma, tenantId)) >= limit;
}

/**
 * Refuses a booking once the month's limit is used. 409 with a stable code so
 * the booking page can say "Fully booked this month" rather than show an error.
 */
export async function assertWithinMonthlyLimit(prisma: BookingCounter, tenantId: bigint, tenant: TenantPlan): Promise<void> {
  if (!(await monthlyLimitReached(prisma, tenantId, tenant))) return;
  const upgrade = nextTier(effectiveTier(tenant));
  throw new HttpException(
    {
      statusCode: HttpStatus.CONFLICT,
      code: 'MONTHLY_BOOKING_LIMIT',
      message: upgrade
        ? `Fully booked this month. The practice can take more bookings on the ${TIER_NAMES[upgrade]} plan.`
        : 'Fully booked this month.',
    },
    HttpStatus.CONFLICT,
  );
}
