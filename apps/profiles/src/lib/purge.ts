/**
 * Cache tags (spec §6.12): one per profile, so a change purges exactly that
 * profile's page, plus one for the sitemap.
 */
export const profileTag = (handle: string) => `profile:${handle}`;
export const SITEMAP_TAG = 'sitemap';

const TAG = /^(profile:[a-z0-9][a-z0-9-]{1,28}[a-z0-9]|sitemap)$/;

/** The tags a purge request may name: only ours, at most 30. */
export function purgeTags(body: unknown): string[] | null {
  const tags = (body as { tags?: unknown })?.tags;
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > 30) return null;
  return tags.every((t) => typeof t === 'string' && TAG.test(t)) ? (tags as string[]) : null;
}

/** Constant-time comparison of the shared purge secret. */
export function secretMatches(sent: string | null, expected: string | undefined): boolean {
  if (!sent || !expected) return false;
  const a = new TextEncoder().encode(sent);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}
