/**
 * Minimal client for Resend's REST API: sending, and managing practices'
 * sending domains. Plain fetch, so there is no SDK to keep in step with.
 * https://resend.com/docs/api-reference
 */

// Overridable so a local stand-in can be used in development and tests.
const RESEND_API = (process.env.RESEND_API_URL || 'https://api.resend.com').replace(/\/$/, '');

export interface ResendDnsRecord {
  /** What the record is for, e.g. "SPF", "DKIM", "Receiving". */
  record: string;
  name: string;
  type: string;
  value: string;
  ttl?: string;
  priority?: number;
  status?: string;
}

export interface ResendDomain {
  id: string;
  name: string;
  status: string;
  records: ResendDnsRecord[];
}

export class ResendError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ResendError';
  }
}

export interface ResendSendInput {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export class ResendClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async sendEmail(input: ResendSendInput): Promise<{ id: string }> {
    return this.request<{ id: string }>('POST', '/emails', {
      from: input.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    });
  }

  createDomain(name: string): Promise<ResendDomain> {
    return this.request<ResendDomain>('POST', '/domains', { name });
  }

  getDomain(id: string): Promise<ResendDomain> {
    return this.request<ResendDomain>('GET', `/domains/${encodeURIComponent(id)}`);
  }

  /** Asks Resend to check the DNS again. Verification itself is asynchronous. */
  async verifyDomain(id: string): Promise<void> {
    await this.request('POST', `/domains/${encodeURIComponent(id)}/verify`);
  }

  async removeDomain(id: string): Promise<void> {
    await this.request('DELETE', `/domains/${encodeURIComponent(id)}`);
  }

  private async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${RESEND_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const message = data?.message || data?.error || `Resend request failed (${res.status})`;
      throw new ResendError(String(message), res.status, data?.name);
    }
    return data as T;
  }
}
