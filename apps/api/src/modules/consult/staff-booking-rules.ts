import { BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { JWT_SECRET } from '../../common/auth.config';

export type StaffPayment = 'LINK' | 'PAID' | 'NONE';

/** How long a staff-sent payment link keeps the session's slot. */
export const STAFF_LINK_HOLD_HOURS = 48;
/** A link must be paid at least this long before the session starts. */
export const LINK_CUTOFF_HOURS = 2;

const HOUR = 60 * 60 * 1000;

export function parseStaffPayment(v: unknown): StaffPayment {
  const s = String(v ?? '').toUpperCase();
  if (s === 'LINK' || s === 'PAID' || s === 'NONE') return s;
  throw new BadRequestException('Choose how the session will be paid.');
}

/** Marking money received stays with the front desk, as the existing mark-paid does. */
export function paymentsAllowed(role: string): StaffPayment[] {
  if (['OWNER', 'ADMIN', 'RECEPTIONIST'].includes(role)) return ['LINK', 'PAID', 'NONE'];
  if (role === 'THERAPIST') return ['LINK', 'NONE'];
  return [];
}

/**
 * When an unpaid link lets the slot go: 48 hours from now, but never later
 * than 2 hours before the session. Null when that is already past.
 */
export function staffLinkHold(now: Date, startsAt: Date): Date | null {
  const hold = new Date(now.getTime() + STAFF_LINK_HOLD_HOURS * HOUR);
  const cutoff = new Date(startsAt.getTime() - LINK_CUTOFF_HOURS * HOUR);
  const end = hold < cutoff ? hold : cutoff;
  return end > now ? end : null;
}

/** What staff say they received. Never more than the price. */
export function paidAmount(input: string | undefined, priceKobo: bigint): bigint {
  if (input === undefined || input === '') return priceKobo;
  if (!/^\d+$/.test(String(input))) throw new BadRequestException('Enter the amount received in whole kobo.');
  const kobo = BigInt(input);
  if (kobo > priceKobo) throw new BadRequestException('The amount received cannot be more than the session price.');
  return kobo;
}

/** Proves a /pay link was issued by us for this booking. Same pattern as the .ics token. */
export function payLinkToken(bookingId: bigint): string {
  return createHmac('sha256', JWT_SECRET).update(`pay:${bookingId}`).digest('hex').slice(0, 32);
}

export function payLinkTokenValid(bookingId: bigint, token: unknown): boolean {
  if (typeof token !== 'string') return false;
  const a = Buffer.from(payLinkToken(bookingId), 'utf8');
  const b = Buffer.from(token, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
