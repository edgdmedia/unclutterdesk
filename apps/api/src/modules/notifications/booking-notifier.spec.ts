import { describe, expect, it, vi } from 'vitest';
import { BookingNotifier } from './booking-notifier.service';
import { NotificationService } from './notification.service';

/**
 * NOT-04: the join link must not leave before the money has arrived. One
 * service owns every message about a booking, so "booked", "confirmed" and
 * "cancelled" cannot disagree about what the client may see.
 */
function booking(over: Record<string, unknown> = {}) {
  return {
    id: 900n,
    tenantId: 1n,
    status: 'PENDING_PAYMENT',
    paymentMethod: 'PAYSTACK',
    amountKobo: 3500000n,
    videoRoomName: 'smith-therapy-900',
    clientProfileId: 42n,
    service: { title: 'Individual Therapy', priceKobo: 3500000n },
    availability: {
      startsAt: new Date('2026-10-06T10:30:00Z'),
      channel: 'VIDEO',
      providerProfileId: 7n,
    },
    client: { firstName: 'Ada', lastName: 'Okafor', email: 'ada@example.com' },
    tenant: { name: 'Smith Therapy', slug: 'smith-therapy', customDomain: null, customDomainStatus: null },
    ...over,
  };
}

function make(b: ReturnType<typeof booking> | null) {
  const prisma: any = {
    consultBooking: { findUnique: vi.fn().mockResolvedValue(b) },
    profile: { findUnique: vi.fn().mockResolvedValue({ firstName: 'Jane', lastName: 'Smith' }) },
  };
  const notifications = { sendEmail: vi.fn().mockResolvedValue({ success: true }), notify: vi.fn().mockResolvedValue([]) } as unknown as NotificationService;
  const notifier = new BookingNotifier(prisma, notifications);
  return { notifier, prisma, notifications };
}

describe('BookingNotifier.booked', () => {
  it('sends the pay email while money is due, without the join link', async () => {
    const { notifier, notifications } = make(booking());
    await notifier.booked(900n);
    const email = (notifications.sendEmail as any).mock.calls[0][0];
    expect(email.title).toBe('Almost there — pay ₦35,000 to confirm your session');
    expect(email.link).toMatch(/\/pay\/900$/);
    expect(email.actionLabel).toBe('Pay ₦35,000');
    expect(email.message).not.toMatch(/meet\.jit\.si/);
    expect(email.message).toMatch(/held while you pay/i);
    expect(email.to).toBe('ada@example.com');
  });

  it('says nothing for a transfer hold — announce already sent the bank details', async () => {
    const { notifier, notifications } = make(booking({ paymentMethod: 'MANUAL' }));
    await notifier.booked(900n);
    expect(notifications.sendEmail).not.toHaveBeenCalled();
  });

  it('a free or waived booking is confirmed at once and gets the join link', async () => {
    const { notifier, notifications } = make(booking({ status: 'CONFIRMED', paymentMethod: 'NONE' }));
    await notifier.booked(900n);
    const email = (notifications.sendEmail as any).mock.calls[0][0];
    expect(email.title).toBe('Your session is booked');
    expect(email.message).toMatch(/meet\.jit\.si\/smith-therapy-900/);
    expect(email.actionLabel).toBe('Join the session');
  });
});

describe('BookingNotifier.confirmed', () => {
  it('sends the join link and a pointer to the client portal', async () => {
    const { notifier, notifications } = make(booking({ status: 'CONFIRMED' }));
    await notifier.confirmed(900n);
    const email = (notifications.sendEmail as any).mock.calls[0][0];
    expect(email.title).toBe('Your session is booked');
    expect(email.message).toMatch(/meet\.jit\.si\/smith-therapy-900/);
    expect(email.message).toMatch(/\/portal/);
    expect(email.type).toBe('bookings.confirmed');
  });

  it('an in-person session gets no join link and points at the portal', async () => {
    const { notifier, notifications } = make(booking({ status: 'CONFIRMED', availability: { startsAt: new Date('2026-10-06T10:30:00Z'), channel: 'OFFICE', providerProfileId: 7n }, videoRoomName: null }));
    await notifier.confirmed(900n);
    const email = (notifications.sendEmail as any).mock.calls[0][0];
    expect(email.message).not.toMatch(/meet\.jit\.si/);
    expect(email.actionLabel).toBe('View my bookings');
    expect(email.link).toMatch(/\/portal$/);
  });
});
