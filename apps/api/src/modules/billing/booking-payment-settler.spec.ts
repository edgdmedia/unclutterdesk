import { describe, it, expect, vi } from 'vitest';
import { BookingPaymentSettler } from './booking-payment-settler.service';

/**
 * BKG-09: one place decides what a successful Paystack charge for a booking
 * means, whether the webhook, the pop-up's confirm call or the expiry job
 * reports it first.
 */
const OK = { status: 'success', paid_at: '2026-10-06T09:40:00Z' };
const base = { id: 900n, availabilityId: 3n, paymentRef: 'booking-900-1', holdReleasedAt: null, refundRef: null, availability: { createdForBooking: false } };

function make(booking: any, { flips = false, slotFree = true, otherActive = 0 } = {}) {
  const tx: any = {
    consultBooking: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), count: vi.fn().mockResolvedValue(otherActive) },
    consultAvailability: { updateMany: vi.fn().mockResolvedValue({ count: slotFree ? 1 : 0 }) },
  };
  const prisma: any = {
    consultBooking: {
      // The first call is the flip by reference; later ones confirm by id.
      updateMany: vi.fn().mockResolvedValueOnce({ count: flips ? 1 : 0 }).mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue(booking),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
  };
  const paystack: any = { refundTransaction: vi.fn().mockResolvedValue({ id: 1, status: 'pending' }) };
  const notifier: any = { confirmed: vi.fn().mockResolvedValue(undefined), latePaymentRefunded: vi.fn().mockResolvedValue(undefined) };
  const calendar: any = { pushBookingToGoogle: vi.fn().mockResolvedValue(undefined) };
  const settler = new BookingPaymentSettler(prisma, paystack, notifier, calendar);
  return { settler, prisma, tx, paystack, notifier, calendar };
}

describe('settling a successful booking charge', () => {
  it('ignores a charge that did not succeed, or one that is not for a booking', async () => {
    const { settler, prisma } = make(base);
    expect(await settler.settle('booking-900-1', { status: 'abandoned' })).toBe('ignored');
    expect(await settler.settle('subscription-4-1', OK)).toBe('ignored');
    expect(prisma.consultBooking.updateMany).not.toHaveBeenCalled();
  });

  it('confirms a pending booking by its reference, records when Paystack was paid, and sends one confirmation', async () => {
    const { settler, prisma, notifier, calendar } = make({ ...base, status: 'PENDING_PAYMENT' }, { flips: true });
    expect(await settler.settle('booking-900-1', OK)).toBe('confirmed');
    expect(prisma.consultBooking.updateMany.mock.calls[0][0]).toEqual({
      where: { paymentRef: 'booking-900-1', status: 'PENDING_PAYMENT' },
      data: { status: 'CONFIRMED', paidAt: new Date(OK.paid_at) },
    });
    expect(calendar.pushBookingToGoogle).toHaveBeenCalledWith(900n);
    expect(notifier.confirmed).toHaveBeenCalledTimes(1);
  });

  it('sets a payment date even when Paystack omits one', async () => {
    const { settler, prisma } = make({ ...base, status: 'PENDING_PAYMENT' }, { flips: true });
    await settler.settle('booking-900-1', { status: 'success' });
    expect(prisma.consultBooking.updateMany.mock.calls[0][0].data.paidAt).toBeInstanceOf(Date);
  });

  it('does nothing more when the same reference already confirmed it (webhook and pop-up race, or a replay)', async () => {
    const { settler, notifier, paystack, calendar } = make({ ...base, status: 'CONFIRMED' });
    expect(await settler.settle('booking-900-1', OK)).toBe('already');
    expect(notifier.confirmed).not.toHaveBeenCalled();
    expect(calendar.pushBookingToGoogle).not.toHaveBeenCalled();
    expect(paystack.refundTransaction).not.toHaveBeenCalled();
  });

  it('confirms a pending booking paid through an older attempt', async () => {
    const { settler, prisma, notifier } = make({ ...base, status: 'PENDING_PAYMENT', paymentRef: 'booking-900-2' });
    expect(await settler.settle('booking-900-1', OK)).toBe('confirmed');
    expect(prisma.consultBooking.updateMany.mock.calls[1][0]).toMatchObject({
      where: { id: 900n, status: 'PENDING_PAYMENT' },
      data: { status: 'CONFIRMED', paymentRef: 'booking-900-1' },
    });
    expect(notifier.confirmed).toHaveBeenCalledWith(900n);
  });

  it('re-confirms a released booking when its time is still free', async () => {
    const { settler, tx, notifier, paystack } = make({ ...base, status: 'CANCELLED', holdReleasedAt: new Date() });
    expect(await settler.settle('booking-900-1', OK)).toBe('reconfirmed');
    expect(tx.consultAvailability.updateMany).toHaveBeenCalledWith({ where: { id: 3n, isActive: true }, data: { isActive: false } });
    expect(tx.consultBooking.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'CONFIRMED', holdReleasedAt: null, paymentRef: 'booking-900-1' });
    expect(notifier.confirmed).toHaveBeenCalledWith(900n);
    expect(paystack.refundTransaction).not.toHaveBeenCalled();
  });

  it('re-confirms a released staff-made time only if nobody else holds it', async () => {
    const released = { ...base, status: 'CANCELLED', holdReleasedAt: new Date(), availability: { createdForBooking: true } };
    const free = make(released);
    expect(await free.settler.settle('booking-900-1', OK)).toBe('reconfirmed');
    expect(free.tx.consultBooking.count.mock.calls[0][0].where).toMatchObject({ availabilityId: 3n, status: { not: 'CANCELLED' } });
    const taken = make(released, { otherActive: 1 });
    expect(await taken.settler.settle('booking-900-1', OK)).toBe('refunded');
  });

  it('refunds a released booking whose time was taken, and tells the client and practice', async () => {
    const { settler, paystack, prisma, notifier } = make({ ...base, status: 'CANCELLED', holdReleasedAt: new Date() }, { slotFree: false });
    expect(await settler.settle('booking-900-1', OK)).toBe('refunded');
    expect(paystack.refundTransaction).toHaveBeenCalledWith('booking-900-1');
    expect(prisma.consultBooking.update.mock.calls[0][0]).toMatchObject({ where: { id: 900n }, data: { refundRef: 'booking-900-1' } });
    expect(notifier.latePaymentRefunded).toHaveBeenCalledWith(900n, 'time_taken');
  });

  it('refunds a payment for a booking someone cancelled', async () => {
    const { settler, paystack, notifier } = make({ ...base, status: 'CANCELLED' });
    expect(await settler.settle('booking-900-1', OK)).toBe('refunded');
    expect(paystack.refundTransaction).toHaveBeenCalledWith('booking-900-1');
    expect(notifier.latePaymentRefunded).toHaveBeenCalledWith(900n, 'cancelled');
  });

  it('refunds a second charge on a booking already confirmed by another reference', async () => {
    const { settler, paystack, notifier } = make({ ...base, status: 'CONFIRMED', paymentRef: 'booking-900-2' });
    expect(await settler.settle('booking-900-1', OK)).toBe('refunded');
    expect(paystack.refundTransaction).toHaveBeenCalledWith('booking-900-1');
    expect(notifier.latePaymentRefunded).toHaveBeenCalledWith(900n, 'duplicate');
  });

  it('does not refund a payment that a concurrent call just used to confirm the booking', async () => {
    // Webhook and pop-up settle the same late payment at once: the other call
    // re-claimed the time first, so this one finds it taken.
    const released = { ...base, status: 'CANCELLED', holdReleasedAt: new Date() };
    const { settler, prisma, paystack } = make(released, { slotFree: false });
    prisma.consultBooking.findUnique
      .mockResolvedValueOnce(released)
      .mockResolvedValueOnce({ ...released, status: 'CONFIRMED', holdReleasedAt: null, paymentRef: 'booking-900-1' });
    expect(await settler.settle('booking-900-1', OK)).toBe('already');
    expect(paystack.refundTransaction).not.toHaveBeenCalled();
  });

  it('does not refund an older-attempt payment that a concurrent call just confirmed', async () => {
    const pending = { ...base, status: 'PENDING_PAYMENT', paymentRef: 'booking-900-2' };
    const { settler, prisma, paystack } = make(pending);
    // The flip by id loses the race (count 0); the winner set this reference.
    prisma.consultBooking.updateMany.mockReset().mockResolvedValue({ count: 0 });
    prisma.consultBooking.findUnique
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce({ ...pending, status: 'CONFIRMED', paymentRef: 'booking-900-1' });
    expect(await settler.settle('booking-900-1', OK)).toBe('already');
    expect(paystack.refundTransaction).not.toHaveBeenCalled();
  });

  it('never refunds the same reference twice', async () => {
    const { settler, paystack } = make({ ...base, status: 'CANCELLED', refundRef: 'booking-900-1' });
    expect(await settler.settle('booking-900-1', OK)).toBe('already');
    expect(paystack.refundTransaction).not.toHaveBeenCalled();
  });

  it('ignores a reference for a booking that does not exist', async () => {
    const { settler, paystack } = make(null);
    expect(await settler.settle('booking-900-1', OK)).toBe('ignored');
    expect(paystack.refundTransaction).not.toHaveBeenCalled();
  });
});
