import type { Payment } from './PortalDataContext';

export const PAYMENT_STATES: Record<string, { label: string; cls: string }> = {
  PAID: { label: 'Paid', cls: 'bg-[#ECFDF5] text-[#059669]' },
  PENDING_PAYMENT: { label: 'Awaiting payment', cls: 'bg-[#FFFBEB] text-[#B45309]' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-[#F1F5F9] text-[#64748B]' },
  FREE: { label: 'No charge', cls: 'bg-[#F1F5F9] text-[#64748B]' },
};

/**
 * A booking's status is about the appointment, not the money, so the two only
 * partly overlap: a CONFIRMED session may be paid or may simply have been free.
 * paidAt is the only thing that actually says money changed hands.
 */
export function paymentState(payment: Payment): { label: string; cls: string } {
  if (payment.status === 'CANCELLED') return PAYMENT_STATES.CANCELLED;
  if (payment.paidAt) return PAYMENT_STATES.PAID;
  if (payment.status === 'PENDING_PAYMENT') return PAYMENT_STATES.PENDING_PAYMENT;
  return PAYMENT_STATES.FREE;
}

export function formatDay(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatMoney(priceKobo: string) {
  return `₦${(Number(priceKobo) / 100).toLocaleString('en-NG')}`;
}

export function formatDateParts(startsAt: string) {
  const date = new Date(startsAt);
  return {
    day: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date).toUpperCase(),
    date: new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date).toUpperCase(),
  };
}

export function formatTimeRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return `${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(start)} — ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(end)}`;
}
