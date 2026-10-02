import { describe, it, expect, vi, afterEach } from 'vitest';
import { ConsultCron } from './consult.cron';

/**
 * BKG-09: an unpaid hold is released only after asking Paystack whether it was
 * paid, so a payment made in the last minutes is confirmed, not lost.
 */
const NOW = new Date('2026-10-06T09:00:00Z');

function make(rows: any[], verify: any) {
  const tx: any = { consultBooking: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, consultAvailability: { updateMany: vi.fn() } };
  const prisma: any = { consultBooking: { findMany: vi.fn().mockResolvedValue(rows) }, $transaction: vi.fn(async (cb: any) => cb(tx)) };
  const manual: any = { released: vi.fn() };
  const paystack: any = { verifyTransaction: verify };
  const settler: any = { settle: vi.fn().mockResolvedValue('confirmed') };
  const notifier: any = { holdReleased: vi.fn().mockResolvedValue(undefined) };
  return { cron: new ConsultCron(prisma, manual, paystack, settler, notifier), prisma, tx, settler, notifier, manual };
}

const online = { id: 900n, availabilityId: 3n, paymentMethod: 'PAYSTACK', paymentRef: 'booking-900-1', holdExpiresAt: new Date('2026-10-06T08:50:00Z') };

describe('releasing unpaid holds (BKG-09)', () => {
  afterEach(() => vi.useRealTimers());

  it('confirms instead of releasing when Paystack says it was paid', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(NOW);
    const { cron, tx, settler } = make([online], vi.fn().mockResolvedValue({ status: 'success' }));
    await cron.handleBookingExpiry();
    expect(settler.settle).toHaveBeenCalledWith('booking-900-1', { status: 'success' });
    expect(tx.consultBooking.updateMany).not.toHaveBeenCalled();
  });

  it('releases an unpaid hold, records when, reopens the time and emails the client', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(NOW);
    const { cron, tx, notifier } = make([online], vi.fn().mockResolvedValue({ status: 'abandoned' }));
    await cron.handleBookingExpiry();
    expect(tx.consultBooking.updateMany.mock.calls[0][0]).toEqual({ where: { id: 900n, status: 'PENDING_PAYMENT' }, data: { status: 'CANCELLED', holdReleasedAt: NOW } });
    expect(tx.consultAvailability.updateMany).toHaveBeenCalledWith({ where: { id: 3n, createdForBooking: false }, data: { isActive: true } });
    expect(notifier.holdReleased).toHaveBeenCalledWith(900n);
  });

  it('waits when Paystack cannot be reached, then releases once two hours overdue', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(NOW);
    const down = vi.fn().mockRejectedValue(new Error('timeout'));
    const first = make([online], down);
    await first.cron.handleBookingExpiry();
    expect(first.tx.consultBooking.updateMany).not.toHaveBeenCalled();
    expect(first.notifier.holdReleased).not.toHaveBeenCalled();

    const old = { ...online, holdExpiresAt: new Date('2026-10-06T06:59:00Z') };
    const later = make([old], down);
    await later.cron.handleBookingExpiry();
    expect(later.tx.consultBooking.updateMany).toHaveBeenCalled();
  });

  it('releases an online hold that never reached Paystack without asking it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(NOW);
    const verify = vi.fn();
    const { cron, tx } = make([{ ...online, paymentRef: null }], verify);
    await cron.handleBookingExpiry();
    expect(verify).not.toHaveBeenCalled();
    expect(tx.consultBooking.updateMany).toHaveBeenCalled();
  });

  it('still releases bank-transfer holds without asking Paystack, with their own email', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(NOW);
    const verify = vi.fn();
    const { cron, manual, notifier } = make([{ ...online, paymentMethod: 'MANUAL', paymentRef: null }], verify);
    await cron.handleBookingExpiry();
    expect(verify).not.toHaveBeenCalled();
    expect(manual.released).toHaveBeenCalledWith(900n);
    expect(notifier.holdReleased).not.toHaveBeenCalled();
  });

  it('finds online holds by their expiry, and old ones made before holds were recorded', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(NOW);
    const { cron, prisma } = make([], vi.fn());
    await cron.handleBookingExpiry();
    const where = prisma.consultBooking.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('PENDING_PAYMENT');
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { paymentMethod: { not: 'MANUAL' }, holdExpiresAt: null, createdAt: { lt: new Date('2026-10-06T08:25:00Z') } },
        { holdExpiresAt: { lt: NOW } },
      ]),
    );
  });
});
