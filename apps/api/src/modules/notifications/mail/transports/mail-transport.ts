import type { OutgoingEmail } from '../outgoing-email';

export type ProviderKey = 'resend' | 'smtp' | 'preview';

/** A way to deliver a packaged email. Adding a provider means adding one of these. */
export interface MailTransport {
  readonly key: ProviderKey;
  /** True when the provider can send from a practice's own verified domain (it signs for it). */
  readonly canSignForDomains: boolean;
  send(email: OutgoingEmail): Promise<{ messageId: string | null; preview?: boolean }>;
}
