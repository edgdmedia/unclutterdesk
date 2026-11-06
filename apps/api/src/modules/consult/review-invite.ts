import { createHmac, timingSafeEqual } from 'crypto';
import { JWT_SECRET } from '../../common/auth.config';

/**
 * The signed part of a review request link: it names one practice's one
 * session, so the review form can trust who the client is without a sign-in,
 * and a link cannot be reused for another session or forged.
 */
export function reviewInviteToken(tenantId: bigint, bookingId: bigint): string {
  return createHmac('sha256', JWT_SECRET).update(`review:${tenantId}:${bookingId}`).digest('hex').slice(0, 32);
}

export function reviewInviteTokenValid(tenantId: bigint, bookingId: bigint, token: unknown): boolean {
  if (typeof token !== 'string') return false;
  const a = Buffer.from(reviewInviteToken(tenantId, bookingId), 'utf8');
  const b = Buffer.from(token, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
