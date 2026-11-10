import { Injectable, Logger } from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'crypto';
import { JOURNAL_API_BASE, JOURNAL_APP_ORIGIN } from '../../common/origins';
import type { JournalPlan } from './journal-plan';

/**
 * Desk's side of the trust with Unclutter Journal (docs/design/journal-integration.md §4–5).
 *
 * One shared secret (DESK_INTEGRATION_SECRET, also set on the Suite API) signs:
 *  - the link request carried in the client's browser to Journal's /link/desk page;
 *  - every server call, over method, path (with /v1), timestamp and body.
 * No user token ever crosses between the systems. The Suite's reference for
 * both formats is apps/api/src/modules/desk-integration/desk-signing.ts.
 */

export const LINK_REQUEST_TTL_SEC = 10 * 60;
const CALL_TIMEOUT_MS = 10_000;

const b64url = (v: Buffer | string) => Buffer.from(v).toString('base64url');
const sha256hex = (v: string) => createHash('sha256').update(v, 'utf8').digest('hex');
const hmac = (secret: string, v: string) => createHmac('sha256', secret).update(v, 'utf8').digest();

/** The configured secret, or null when the integration is not set up (then nothing about Journal shows). */
export function integrationSecret(): string | null {
  const s = process.env.DESK_INTEGRATION_SECRET?.trim();
  return s && s.length >= 32 ? s : null;
}

export interface LinkRequestFields {
  practiceName: string;
  practitionerName: string;
  clientRef: string;
  returnUrl: string;
}

export function signLinkRequest(secret: string, nonce: string, f: LinkRequestFields, now = new Date()) {
  const iat = Math.floor(now.getTime() / 1000);
  const payload = b64url(
    JSON.stringify({
      v: 1,
      nonce,
      iat,
      exp: iat + LINK_REQUEST_TTL_SEC,
      practice_name: f.practiceName.slice(0, 200),
      practitioner_name: f.practitionerName.slice(0, 200),
      client_ref: f.clientRef,
      return_url: f.returnUrl,
    }),
  );
  return `${payload}.${b64url(hmac(secret, payload))}`;
}

export function signServerRequest(secret: string, method: string, pathWithQuery: string, timestamp: string, body: string) {
  return hmac(secret, `${method.toUpperCase()}\n${pathWithQuery}\n${timestamp}\n${sha256hex(body)}`).toString('hex');
}

/** Journal answered 404: the link (or plan) is gone there, so Desk treats it as ended. */
export class JournalGoneError extends Error {}
/** Journal could not be reached, or refused for another reason. The message is safe to show. */
export class JournalUnavailableError extends Error {}

export interface JournalProgress {
  status: string;
  total: number;
  delivered: number;
  responded: number;
  last_responded_at: string | null;
  next_delivery_at: string | null;
  days: Array<{ day: number; delivered_at: string; responded_at: string | null }>;
}

export interface JournalSharedItem {
  entry_id: string;
  plan_ref: string | null;
  prompt_text: string | null;
  content: string;
  written_at: string;
  updated_at: string;
  shared_at: string;
}

@Injectable()
export class JournalSuiteClient {
  private readonly logger = new Logger(JournalSuiteClient.name);

  configured(): boolean {
    return integrationSecret() !== null;
  }

  /** Where the client's browser goes to confirm a link: Journal's own page, carrying the signed request. */
  linkUrl(nonce: string, fields: LinkRequestFields): string {
    const url = new URL('/link/desk', JOURNAL_APP_ORIGIN);
    url.searchParams.set('request', signLinkRequest(this.secret(), nonce, fields));
    return url.toString();
  }

  static newNonce(): string {
    return randomBytes(24).toString('base64url');
  }

  exchange(code: string) {
    return this.call<{ link_id: string; profile_name: string | null }>('POST', '/integrations/desk/link/exchange', { code });
  }

  putPlan(ref: string, body: { link_id: string; plan: JournalPlan; timezone: string; delivery_time_local: string; starts_on: 'next_day' }) {
    return this.call<{ series_id: string; subscription_id: string; days: number; next_delivery_at: string | null }>(
      'PUT',
      `/integrations/desk/plans/${encodeURIComponent(ref)}`,
      body,
    );
  }

  endPlan(ref: string, linkId: string) {
    return this.call<{ ok: true }>('DELETE', `/integrations/desk/plans/${encodeURIComponent(ref)}?link_id=${encodeURIComponent(linkId)}`);
  }

  progress(ref: string, linkId: string) {
    return this.call<JournalProgress>('GET', `/integrations/desk/plans/${encodeURIComponent(ref)}/progress?link_id=${encodeURIComponent(linkId)}`);
  }

  shared(linkId: string) {
    return this.call<JournalSharedItem[]>('GET', `/integrations/desk/links/${encodeURIComponent(linkId)}/shared`);
  }

  endLink(linkId: string) {
    return this.call<{ ok: true }>('DELETE', `/integrations/desk/links/${encodeURIComponent(linkId)}`);
  }

  private secret(): string {
    const s = integrationSecret();
    if (!s) throw new JournalUnavailableError('Unclutter Journal is not set up for this platform yet.');
    return s;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const secret = this.secret();
    const url = new URL(`${JOURNAL_API_BASE}${path}`);
    const raw = body === undefined ? '' : JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers: Record<string, string> = {
      'X-Desk-Timestamp': timestamp,
      'X-Desk-Signature': signServerRequest(secret, method, `${url.pathname}${url.search}`, timestamp, raw),
      Accept: 'application/json',
    };
    if (raw) headers['Content-Type'] = 'application/json';

    let res: Response;
    try {
      res = await fetch(url, { method, headers, body: raw || undefined, signal: AbortSignal.timeout(CALL_TIMEOUT_MS) });
    } catch (err) {
      this.logger.warn(`Journal ${method} ${url.pathname} failed: ${(err as Error).message}`);
      throw new JournalUnavailableError('Unclutter Journal could not be reached. Try again in a moment.');
    }
    if (res.status === 404) throw new JournalGoneError('Not found in Unclutter Journal');
    const text = await res.text();
    if (!res.ok) {
      // Journal's own message (in plain words) for a plan it refused; never pass anything else through.
      let message: string | null = null;
      if (res.status === 400) {
        try {
          const m = JSON.parse(text)?.message;
          if (typeof m === 'string' && m.length <= 300) message = m;
        } catch {
          // Not JSON: fall through.
        }
      }
      this.logger.warn(`Journal ${method} ${url.pathname} answered ${res.status}`);
      throw new JournalUnavailableError(message ?? 'Unclutter Journal could not do that just now. Try again in a moment.');
    }
    try {
      return (text ? JSON.parse(text) : {}) as T;
    } catch {
      throw new JournalUnavailableError('Unclutter Journal sent an answer Desk could not read.');
    }
  }
}
