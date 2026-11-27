import { createHash, randomBytes, randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';

/**
 * §6.14: "Set up your own booking in one step". A therapist whose last place
 * on their profile has gone gets an emailed link that creates a FREE practice
 * for them and signs them in. They may not be able to sign in otherwise (their
 * only memberships can all be inactive), so the link itself is the credential:
 * random, stored only as a hash, single use, and replaced by any newer link.
 */
export const OWN_BOOKING_TOKEN = 'own_booking';
export const OWN_BOOKING_LINK_DAYS = 14;

export function hashOwnBookingToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Issues a fresh link token for the person, revoking any earlier one. Returns the raw token for the email. */
export async function issueOwnBookingToken(prisma: Pick<PrismaClient, 'token'>, userId: bigint, now = new Date()): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await prisma.token.deleteMany({ where: { userId, type: OWN_BOOKING_TOKEN } });
  await prisma.token.create({
    data: {
      id: `${userId.toString()}-own-booking-${randomUUID()}`,
      userId,
      type: OWN_BOOKING_TOKEN,
      tokenHash: hashOwnBookingToken(token),
      expiresAt: new Date(now.getTime() + OWN_BOOKING_LINK_DAYS * 86_400_000),
    },
  });
  return token;
}
