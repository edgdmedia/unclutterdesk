import { describe, it, expect, vi } from 'vitest';
import { assertWithinMonthlyLimit, countMonthlyBookings, monthlyLimitReached } from './booking-limits';

const FREE = { subscriptionTier: 'FREE', subscriptionStatus: null, complimentaryUntil: null, complimentaryReason: null };
const PRO = { ...FREE, subscriptionTier: 'PRO', subscriptionStatus: 'active' };
const counter = (n: number) => ({ consultBooking: { count: vi.fn().mockResolvedValue(n) } });

describe('booking limits (§5.5)', () => {
  it('count bookings created since midnight on the 1st in Lagos, not server time', async () => {
    const prisma = counter(0);
    await countMonthlyBookings(prisma, 1n, new Date('2026-10-31T23:30:00Z')); // 00:30, 1 Nov in Lagos
    expect(prisma.consultBooking.count.mock.calls[0][0].where).toEqual({
      tenantId: 1n,
      createdAt: { gte: new Date('2026-10-31T23:00:00Z') },
      status: { not: 'CANCELLED' },
    });
  });

  it('never apply on unlimited plans', async () => {
    const prisma = counter(10_000);
    expect(await monthlyLimitReached(prisma, 1n, PRO)).toBe(false);
    expect(prisma.consultBooking.count).not.toHaveBeenCalled();
  });

  it('block an online booking once the month is used', async () => {
    await expect(assertWithinMonthlyLimit(counter(10), 1n, FREE)).rejects.toMatchObject({ status: 409 });
  });

  it('never block a staff entry for today (Lagos), even over the limit', async () => {
    const now = new Date('2026-11-05T22:30:00Z'); // 23:30 on the 5th in Lagos
    const later = new Date('2026-11-05T22:50:00Z'); // still the 5th in Lagos
    const prisma = counter(99);
    await expect(assertWithinMonthlyLimit(prisma, 1n, FREE, { sessionStartsAt: later, now })).resolves.toBeUndefined();
    expect(prisma.consultBooking.count).not.toHaveBeenCalled();
  });

  it('limit a staff entry for a future date like an online booking', async () => {
    const now = new Date('2026-11-05T22:30:00Z');
    const tomorrow = new Date('2026-11-05T23:10:00Z'); // 00:10 on the 6th in Lagos
    await expect(assertWithinMonthlyLimit(counter(10), 1n, FREE, { sessionStartsAt: tomorrow, now })).rejects.toMatchObject({ status: 409 });
  });
});
