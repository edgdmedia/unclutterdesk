import { BadRequestException } from '@nestjs/common';

/** Bookings a Starter practice may take in a calendar month. */
export const STARTER_MONTHLY_BOOKINGS = 20;

export async function assertWithinMonthlyLimit(
  prisma: { consultBooking: { count: (args: any) => Promise<number> } },
  tenantId: bigint,
  tier: string | null | undefined,
): Promise<void> {
  if ((tier || 'STARTER').toUpperCase() !== 'STARTER') return;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const count = await prisma.consultBooking.count({
    where: { tenantId, createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
  });
  if (count >= STARTER_MONTHLY_BOOKINGS) {
    throw new BadRequestException('Monthly booking limit reached. Upgrade to Pro to accept unlimited bookings.');
  }
}
