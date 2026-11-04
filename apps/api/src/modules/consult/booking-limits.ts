import { HttpException, HttpStatus } from '@nestjs/common';
import { effectiveTier, nextTier, practiceEntitlements, TIER_NAMES, type PlanFields } from '../entitlements/entitlements';
import { lagosMonthStart, lagosTomorrowStart } from '../../common/lagos-time';

type BookingCounter = { consultBooking: { count: (args: any) => Promise<number> } };

/**
 * Bookings created this month (Lagos time) that count towards the plan's
 * limit (spec §5.5): everything not cancelled — confirmed bookings, active
 * payment holds, transfers awaiting confirmation and staff entries. Abandoned
 * holds are cancelled by the consult cron, so they stop counting.
 */
export function countMonthlyBookings(prisma: BookingCounter, tenantId: bigint, now: Date = new Date()): Promise<number> {
  return prisma.consultBooking.count({
    where: { tenantId, createdAt: { gte: lagosMonthStart(now) }, status: { not: 'CANCELLED' } },
  });
}

/** True when the practice has used up this month's bookings. Always false on unlimited plans. */
export async function monthlyLimitReached(
  prisma: BookingCounter,
  tenantId: bigint,
  tenant: PlanFields | null | undefined,
  adding = 1,
): Promise<boolean> {
  const limit = practiceEntitlements(tenant).monthlyBookingLimit;
  if (limit === null) return false;
  // `adding` bookings must all fit: several booked together count together.
  return (await countMonthlyBookings(prisma, tenantId)) + adding > limit;
}

/**
 * Refuses a booking once the month's limit is used. 409 with a stable code so
 * the booking page can say "Fully booked this month" rather than show an error.
 *
 * `sessionStartsAt` is given for bookings staff enter: one for today or an
 * earlier date (Lagos time) records a session that happened and is never
 * blocked; a future one follows the limit like an online booking, or staff
 * entry with a pay link would bypass it.
 */
export async function assertWithinMonthlyLimit(
  prisma: BookingCounter,
  tenantId: bigint,
  tenant: PlanFields | null | undefined,
  opts: { sessionStartsAt?: Date; now?: Date; adding?: number } = {},
): Promise<void> {
  if (opts.sessionStartsAt && opts.sessionStartsAt < lagosTomorrowStart(opts.now)) return;
  if (!(await monthlyLimitReached(prisma, tenantId, tenant, opts.adding ?? 1))) return;
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
