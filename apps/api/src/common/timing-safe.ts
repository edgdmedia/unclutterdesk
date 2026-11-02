/**
 * Timing-safe string comparison helper.
 *
 * Used for comparing secrets and other sensitive values where an attacker
 * could measure response times to guess the correct value character by character.
 *
 * Returns false unless both are non-empty strings of equal byte length,
 * then uses crypto.timingSafeEqual.
 */
import { timingSafeEqual } from 'crypto';

export function safeEqual(sent: unknown, expected: unknown): boolean {
  if (typeof sent !== 'string' || typeof expected !== 'string') return false;
  if (sent.length === 0 || expected.length === 0) return false;
  const a = Buffer.from(sent, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.byteLength !== b.byteLength) return false;
  return timingSafeEqual(a, b);
}