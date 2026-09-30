export type ChannelKey = 'in_app' | 'email' | 'push' | 'sms';

export const CHANNEL_KEYS: readonly ChannelKey[] = ['in_app', 'email', 'push', 'sms'];

export interface ChannelBrand {
  practiceName: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  logoUrl?: string | null;
  publicEmail?: string | null;
  publicPhone?: string | null;
}

export interface ChannelRecipient {
  /** Null for pre-tenant sends (e.g. password reset before any profile exists). */
  profileId: bigint | null;
  /** Null for pre-tenant sends — the hub then falls back to default branding. */
  tenantId: bigint | null;
  userId?: bigint | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
}

export interface ChannelPayload {
  type: string;
  title: string;
  message: string;
  /** Rendered as a prominent code box (e.g. email verification codes). */
  code?: string;
  /** Heading over the code box. Defaults to "Verification code". */
  codeLabel?: string;
  link?: string;
  actionLabel?: string;
  data?: Record<string, unknown>;
  brand?: ChannelBrand;
}

export interface DeliveryResult {
  success: boolean;
  providerId?: string | null;
  error?: string;
  skipped?: boolean;
}

/**
 * A notification channel (in-app, email, push, sms). Implementations declare
 * whether their provider is "wired" (configured via env) and send a payload to
 * a recipient. The hub (NotificationService) decides which channels fire.
 */
export interface NotificationChannel {
  readonly key: ChannelKey;
  /** True when the underlying provider/config is available (SMTP env, VAPID keys, SMS keys, ...). */
  isWired(): boolean;
  send(recipient: ChannelRecipient, payload: ChannelPayload): Promise<DeliveryResult>;
  /** Optional: public key clients need to register with this channel (e.g. VAPID). */
  getPublicKey?(): string | null;
}

export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');
