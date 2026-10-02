import { describe, expect, it, vi } from 'vitest';
import { BookingNotifier } from './booking-notifier.service';
import { NotificationService } from './notification.service';
import { payLinkToken } from '../consult/staff-booking-rules';

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

function make(b: ReturnType<typeof booking> | null, staff: { id: bigint }[] = [{ id: 11n }, { id: 12n }]) {
  const prisma: any = {
    consultBooking: { findUnique: vi.fn().mockResolvedValue(b) },
    profile: {
      findUnique: vi.fn().mockResolvedValue({ firstName: 'Jane', lastName: 'Smith' }),
      findMany: vi.fn().mockResolvedValue(staff),
    },
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
    // BKG-09: the pay page needs its token, or the link doesn't open.
    expect(email.link).toMatch(new RegExp(`/pay/900\\?t=${payLinkToken(900n)}$`));
    expect(email.actionLabel).toBe('Pay ₦35,000');
    expect(email.message).not.toMatch(/meet\.jit\.si/);
    expect(email.message).toMatch(/held while you pay/i);
    expect(email.to).toBe('ada@example.com');
  });

  it('says until when the time is held (BKG-09)', async () => {
    const { notifier, notifications } = make(booking({ holdExpiresAt: new Date('2026-10-06T08:42:00Z') }));
    await notifier.booked(900n);
    expect((notifications.sendEmail as any).mock.calls[0][0].message).toMatch(/Your time is held until 9:42 AM\./);
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
    // VID-01: the join link opens the session's room in the app, never a provider URL.
    expect(email.link).toMatch(/\/portal\/sessions\/900\/room$/);
    expect(email.actionLabel).toBe('Join session (opens 15 minutes before)');
  });
});

describe('BookingNotifier.confirmed', () => {
  it('sends the join link and a pointer to the client portal', async () => {
    const { notifier, notifications } = make(booking({ status: 'CONFIRMED' }));
    await notifier.confirmed(900n);
    const email = (notifications.sendEmail as any).mock.calls[0][0];
    expect(email.title).toBe('Your session is booked');
    expect(email.type).toBe('bookings.confirmed');
    // Laid out, not one run-on paragraph with raw addresses in it.
    expect(email.message).toBe('Smith Therapy has confirmed your session.');
    expect(email.message).not.toMatch(/https?:/);
    expect(email.details).toEqual([
      { label: 'Session', value: 'Individual Therapy' },
      { label: 'With', value: 'Jane Smith' },
      { label: 'When', value: 'Tuesday 6 October at 11:30' },
      { label: 'Where', value: 'Online (video)' },
    ]);
    // VID-01: the join link opens the session's room in the app, never a provider URL.
    expect(email.link).toMatch(/\/portal\/sessions\/900\/room$/);
    expect(email.actionLabel).toBe('Join session (opens 15 minutes before)');
    expect(email.links).toContainEqual({ label: 'Manage your booking', url: expect.stringMatching(/\/portal$/) });
  });

  it("keeps a Google Meet session's Meet link", async () => {
    const { notifier, notifications } = make(booking({ status: 'CONFIRMED', videoRoomName: 'https://meet.google.com/abc-defg-hij' }));
    await notifier.confirmed(900n);
    expect((notifications.sendEmail as any).mock.calls[0][0].link).toBe('https://meet.google.com/abc-defg-hij');
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


describe('BookingNotifier.notifyStaff (NOT-05)', () => {
  it('tells the therapist and this practice’s owners and admins about a new booking', async () => {
    const { notifier, prisma, notifications } = make(booking());
    await notifier.notifyStaff(900n, 'booked');
    const where = (prisma.profile.findMany as any).mock.calls[0][0].where;
    expect(where.tenantId).toBe(1n);
    expect(where.role.in).toEqual(['OWNER', 'ADMIN']);
    expect(where.status).toBe('active');
    const notice = (notifications.notify as any).mock.calls[0][0];
    expect(notice.profileIds).toEqual(expect.arrayContaining([7n, 11n, 12n]));
    expect(notice.profileIds).toHaveLength(3);
    expect(notice.type).toBe('consult.booking_created');
    expect(notice.title).toBe('New booking');
    expect(notice.message).toBe('Ada Okafor booked Individual Therapy for Tue, 6 Oct · 11:30 AM. Waiting for payment.');
    expect(notice.link).toBe('/dashboard/sessions/900');
    expect(notice.preferenceCategory).toBe('activity');
  });

  it('lists the therapist once when they are also an owner', async () => {
    const { notifier, notifications } = make(booking(), [{ id: 7n }, { id: 12n }]);
    await notifier.notifyStaff(900n, 'booked');
    const ids = (notifications.notify as any).mock.calls[0][0].profileIds;
    expect(ids.filter((id: bigint) => id === 7n)).toHaveLength(1);
  });

  it('includes the front desk only for a transfer to confirm', async () => {
    const { notifier, prisma, notifications } = make(booking());
    await notifier.notifyStaff(900n, 'transfer_sent');
    expect((prisma.profile.findMany as any).mock.calls[0][0].where.role.in).toEqual(['OWNER', 'ADMIN', 'RECEPTIONIST']);
    const notice = (notifications.notify as any).mock.calls[0][0];
    expect(notice.title).toBe('Transfer to confirm');
    expect(notice.message).toBe('Ada Okafor says they’ve sent ₦35,000 (ref UD-900). Check your account and mark it paid.');
  });

  it('reports money received', async () => {
    const { notifier, notifications } = make(booking({ status: 'CONFIRMED' }));
    await notifier.notifyStaff(900n, 'paid');
    const notice = (notifications.notify as any).mock.calls[0][0];
    expect(notice.type).toBe('consult.booking_paid');
    expect(notice.message).toBe('Ada Okafor paid ₦35,000 for Tue, 6 Oct · 11:30 AM.');
  });

  it('reports a cancellation', async () => {
    const { notifier, notifications } = make(booking({ status: 'CANCELLED' }));
    await notifier.notifyStaff(900n, 'cancelled');
    const notice = (notifications.notify as any).mock.calls[0][0];
    expect(notice.type).toBe('consult.booking_cancelled');
    expect(notice.message).toBe('Ada Okafor’s session on Tue, 6 Oct · 11:30 AM was cancelled.');
  });

  it('tells the practice a form arrived, linked to the client', async () => {
    const { notifier, notifications } = make(booking());
    await notifier.notifyFormSubmitted(1n, { clientProfileId: 42n, clientName: 'Ada Okafor', formTitle: 'About you' });
    const notice = (notifications.notify as any).mock.calls[0][0];
    expect(notice.type).toBe('intake.form_submitted');
    expect(notice.title).toBe('Form received');
    expect(notice.message).toBe('Ada Okafor completed About you.');
    expect(notice.link).toBe('/dashboard/clients/42');
  });

  it('booked() also tells staff, and a free booking is not reported as paid', async () => {
    const { notifier, notifications } = make(booking({ status: 'CONFIRMED', paymentMethod: 'NONE', amountKobo: null, service: { title: 'Individual Therapy', priceKobo: 0n } }));
    await notifier.booked(900n);
    const types = (notifications.notify as any).mock.calls.map((c: any[]) => c[0].type);
    expect(types).toContain('consult.booking_created');
    expect(types).not.toContain('consult.booking_paid');
  });
});

describe('BookingNotifier.latePaymentRefunded (BKG-09)', () => {
  it('tells the client a late payment is refunded because the time was taken, and offers another time', async () => {
    const { notifier, notifications } = make(booking({ status: 'CANCELLED' }));
    await notifier.latePaymentRefunded(900n, 'time_taken');
    const email = (notifications.sendEmail as any).mock.calls[0][0];
    expect(email.type).toBe('bookings.payment_refunded');
    expect(email.title).toBe("We're refunding your ₦35,000");
    expect(email.message).toMatch(/arrived after the time was released, and someone else has since booked it/);
    expect(email.message).toMatch(/Paystack is refunding ₦35,000/);
    expect(email.link).toMatch(/\/book$/);
    expect(email.actionLabel).toBe('Choose another time');
  });

  it('explains a second payment for a session that was already paid, pointing at the portal', async () => {
    const { notifier, notifications } = make(booking({ status: 'CONFIRMED' }));
    await notifier.latePaymentRefunded(900n, 'duplicate');
    const email = (notifications.sendEmail as any).mock.calls[0][0];
    expect(email.message).toMatch(/already paid/);
    expect(email.message).not.toMatch(/someone else/);
    expect(email.link).toMatch(/\/portal$/);
  });

  it('explains a payment for a cancelled session', async () => {
    const { notifier, notifications } = make(booking({ status: 'CANCELLED' }));
    await notifier.latePaymentRefunded(900n, 'cancelled');
    expect((notifications.sendEmail as any).mock.calls[0][0].message).toMatch(/was cancelled/);
  });

  it('tells the therapist and the practice owners about the refund', async () => {
    const { notifier, notifications } = make(booking({ status: 'CANCELLED' }));
    await notifier.latePaymentRefunded(900n, 'time_taken');
    const notice = (notifications.notify as any).mock.calls[0][0];
    expect(notice.profileIds).toEqual([7n, 11n, 12n]);
    expect(notice.title).toBe('Payment refunded');
    expect(notice.message).toBe('Ada Okafor’s ₦35,000 for Tue, 6 Oct · 11:30 AM arrived after the time was released and taken, so it is being refunded.');
  });
});

describe('BookingNotifier.holdReleased (BKG-09)', () => {
  it('tells the client the hold ended and links back to pay, if the time is still free', async () => {
    const { notifier, notifications } = make(booking({ status: 'CANCELLED' }));
    await notifier.holdReleased(900n);
    const email = (notifications.sendEmail as any).mock.calls[0][0];
    expect(email.type).toBe('bookings.hold_released');
    expect(email.title).toBe('Your held time was released');
    expect(email.message).toMatch(/If it's still free, you can pay now and keep it\./);
    expect(email.link).toMatch(new RegExp(`/pay/900\\?t=${payLinkToken(900n)}$`));
    expect(email.actionLabel).toBe('Try again');
  });
});
