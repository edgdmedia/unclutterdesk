import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { verifyResendWebhook } from './webhook-signature';

// Resend signs webhooks the Svix way: HMAC-SHA256 over "id.timestamp.body",
// keyed with the base64 part of a "whsec_" secret.
const SECRET_BYTES = Buffer.from('unclutter-desk-test-secret-32bytes!!');
const SECRET = `whsec_${SECRET_BYTES.toString('base64')}`;

function sign(id: string, timestamp: string, body: string) {
  const sig = createHmac('sha256', SECRET_BYTES).update(`${id}.${timestamp}.${body}`).digest('base64');
  return `v1,${sig}`;
}

const now = () => Math.floor(Date.now() / 1000).toString();

describe('verifyResendWebhook', () => {
  const body = JSON.stringify({ type: 'domain.updated', data: { id: 'd1', status: 'verified' } });

  it('accepts a correctly signed, fresh payload', () => {
    const ts = now();
    expect(
      verifyResendWebhook(body, { id: 'msg_1', timestamp: ts, signature: sign('msg_1', ts, body) }, SECRET),
    ).toBe(true);
  });

  it('accepts when one of several listed signatures matches (key rotation)', () => {
    const ts = now();
    const header = `v1,bm90LXRoZS1yaWdodC1vbmU= ${sign('msg_1', ts, body)}`;
    expect(verifyResendWebhook(body, { id: 'msg_1', timestamp: ts, signature: header }, SECRET)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const ts = now();
    const signature = sign('msg_1', ts, body);
    expect(verifyResendWebhook(body.replace('verified', 'failed'), { id: 'msg_1', timestamp: ts, signature }, SECRET)).toBe(false);
  });

  it('rejects a stale timestamp, so a captured request cannot be replayed later', () => {
    const ts = (Math.floor(Date.now() / 1000) - 10 * 60).toString();
    expect(verifyResendWebhook(body, { id: 'msg_1', timestamp: ts, signature: sign('msg_1', ts, body) }, SECRET)).toBe(false);
  });

  it('rejects when headers or the secret are missing', () => {
    const ts = now();
    expect(verifyResendWebhook(body, { id: '', timestamp: ts, signature: sign('msg_1', ts, body) }, SECRET)).toBe(false);
    expect(verifyResendWebhook(body, { id: 'msg_1', timestamp: ts, signature: sign('msg_1', ts, body) }, '')).toBe(false);
  });
});
