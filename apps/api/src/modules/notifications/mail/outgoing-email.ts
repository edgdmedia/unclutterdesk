/** Who an email is from: decided once, by SenderIdentityService. */
export interface Sender {
  name: string;
  address: string;
}

/**
 * An email packaged and ready to deliver. Every provider receives this same
 * shape, so the sender can't differ between Resend, SMTP or a later one.
 */
export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from: Sender;
  replyTo?: string;
}

/** "Name" <address>, with quotes in the name escaped. */
export function formatSender(name: string, address: string): string {
  return `"${name.trim().replace(/[\\"]/g, '\\$&')}" <${address}>`;
}

/** The address part of "Name <a@b>" or a bare "a@b". */
export function addressOf(value: string): string {
  const raw = value.trim();
  return raw.match(/<([^>]+)>/)?.[1]?.trim() ?? raw;
}

/** The name part of "Name <a@b>", or null for a bare address. */
export function nameOf(value: string): string | null {
  const name = value.trim().match(/^"?([^"<]+?)"?\s*</)?.[1]?.trim();
  return name || null;
}
