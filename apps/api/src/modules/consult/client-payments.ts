import { chargedKobo } from '../../common/revenue';

export interface ClientPaymentRow {
  /** Unique across both kinds: booking-<id> or plan-<id>. */
  id: string;
  /** The booking, once there is one; null for a session not scheduled yet. */
  bookingId: string | null;
  planSessionId: string | null;
  serviceTitle: string;
  /** Null until a time is chosen. */
  sessionAt: string | null;
  amountKobo: string;
  discountCode: string | null;
  status: string;
  paidAt: string | null;
  reference: string | null;
  bookedAt: string;
}

/**
 * One client's payments: the client page and the portal read this, so the
 * two cannot drift (they were two copies). Scoped to the client given; the
 * portal passes the session's own profile id, never anything the caller sent.
 *
 * Bookings as they were charged, plus sessions paid at the practice with no
 * time yet (§11.2), whose only record of the money is the plan session. A
 * booking scheduled from a plan session (PLAN) carries no charge and is left
 * out: its money is on the earlier booking or the plan session's own row.
 */
export async function clientPaymentHistory(prisma: any, tenantId: bigint, clientProfileId: bigint) {
  const [bookings, planSessions] = await Promise.all([
    prisma.consultBooking.findMany({
      where: { tenantId, clientProfileId, paymentMethod: { not: 'PLAN' } },
      include: { service: { select: { title: true, priceKobo: true } }, availability: { select: { startsAt: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.planSession.findMany({
      where: { tenantId, clientProfileId, paidOnBookingId: null },
      include: { booking: { select: { id: true, availability: { select: { startsAt: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ]);
  const serviceIds = [...new Set(planSessions.map((p: any) => p.serviceId.toString()))] as string[];
  const services: any[] = serviceIds.length
    ? await prisma.consultService.findMany({ where: { tenantId, id: { in: serviceIds.map((x) => BigInt(x)) } }, select: { id: true, title: true } })
    : [];
  const title = new Map(services.map((s) => [s.id.toString(), s.title as string]));

  const rows: Array<ClientPaymentRow & { at: number }> = [
    ...bookings
      .filter((b: any) => b.paymentMethod !== 'PLAN')
      .map((b: any) => ({
        id: `booking-${b.id}`,
        bookingId: b.id.toString(),
        planSessionId: null,
        serviceTitle: b.service.title,
        sessionAt: b.availability.startsAt.toISOString(),
        amountKobo: chargedKobo(b).toString(),
        discountCode: b.discountCodeUsed,
        status: b.status,
        paidAt: b.paidAt ? b.paidAt.toISOString() : null,
        // Enough to match against a bank statement.
        reference: b.paymentRef,
        bookedAt: b.createdAt.toISOString(),
        at: b.createdAt.getTime(),
      })),
    ...planSessions.map((p: any) => ({
      id: `plan-${p.id}`,
      bookingId: p.booking ? p.booking.id.toString() : null,
      planSessionId: p.id.toString(),
      serviceTitle: title.get(p.serviceId.toString()) ?? 'Session',
      sessionAt: p.booking ? p.booking.availability.startsAt.toISOString() : null,
      amountKobo: p.amountKobo.toString(),
      discountCode: null,
      // Paid (or no charge) and kept: never "awaiting payment".
      status: p.status === 'REFUNDED' ? 'CANCELLED' : 'CONFIRMED',
      paidAt: p.paidAt ? p.paidAt.toISOString() : null,
      reference: null,
      bookedAt: p.createdAt.toISOString(),
      at: p.createdAt.getTime(),
    })),
  ].sort((a, b) => b.at - a.at);

  const payments: ClientPaymentRow[] = rows.map(({ at: _at, ...r }) => r);
  const totalPaid = payments.filter((p) => p.paidAt).reduce((t, p) => t + BigInt(p.amountKobo), 0n);
  const outstanding = payments.filter((p) => p.status === 'PENDING_PAYMENT').reduce((t, p) => t + BigInt(p.amountKobo), 0n);
  return { payments, totalPaidKobo: totalPaid.toString(), outstandingKobo: outstanding.toString() };
}
