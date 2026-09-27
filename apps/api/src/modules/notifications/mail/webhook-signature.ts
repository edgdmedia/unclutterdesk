import { createHmac, timingSafeEqual } from 'crypto';

/** How old a webhook may be before it is treated as a replay. */
const TOLERANCE_SECONDS = 5 * 60;

export interface WebhookHeaders {
  id: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
}

/**
 * Checks a Resend webhook. Resend signs the Svix way: HMAC-SHA256 over
 * "{svix-id}.{svix-timestamp}.{raw body}", keyed with the base64 part of the
 * "whsec_" secret. The svix-signature header may list several "v1,<sig>"
 * values (one per active key), and any one matching is enough.
 *
 * Must be given the raw request body: re-serialised JSON will not match.
 */
export function verifyResendWebhook(rawBody: string, headers: WebhookHeaders, secret: string): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !secret) return false;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) return false;
  if (Math.abs(Date.now() / 1000 - sentAt) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret, 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest();

  return signature.split(' ').some((part) => {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) return false;
    const given = Buffer.from(value, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
