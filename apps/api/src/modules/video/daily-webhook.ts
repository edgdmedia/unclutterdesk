import { createHmac, timingSafeEqual } from 'crypto';

/**
 * VID-01: Daily signs each webhook with HMAC-SHA256 over
 * `${X-Webhook-Timestamp}.${raw body}`, keyed with the base64-decoded secret,
 * and sends the result base64-encoded in X-Webhook-Signature.
 */
export function verifyDailySignature(
  secretBase64: string,
  signature: string | undefined,
  timestamp: string | undefined,
  rawBody: Buffer | string | undefined,
): boolean {
  if (!secretBase64 || !signature || !timestamp || !rawBody) return false;
  const expected = createHmac('sha256', Buffer.from(secretBase64, 'base64'))
    .update(`${timestamp}.${rawBody.toString()}`)
    .digest();
  const given = Buffer.from(signature, 'base64');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
