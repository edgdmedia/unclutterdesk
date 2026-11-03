import { BadRequestException } from '@nestjs/common';

/**
 * Social links (§6.1): a list of up to MAX_SOCIAL_LINKS https links, any
 * site. The platform is worked out from the address, for the icon and label;
 * anything unrecognised is shown as "Website". Stored as a JSON array of
 * URLs in PractitionerProfile.socialLinks; the older keyed form
 * ({ instagram: "https://…" }) is still read.
 */
export const MAX_SOCIAL_LINKS = 8;
const MAX_URL_LENGTH = 300;

export const SOCIAL_PLATFORMS = [
  { platform: 'instagram', label: 'Instagram', hosts: ['instagram.com'] },
  { platform: 'linkedin', label: 'LinkedIn', hosts: ['linkedin.com'] },
  { platform: 'facebook', label: 'Facebook', hosts: ['facebook.com', 'fb.com'] },
  { platform: 'x', label: 'X', hosts: ['x.com', 'twitter.com'] },
  { platform: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'] },
  { platform: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  { platform: 'threads', label: 'Threads', hosts: ['threads.net', 'threads.com'] },
  { platform: 'whatsapp', label: 'WhatsApp', hosts: ['wa.me', 'whatsapp.com'] },
  { platform: 'substack', label: 'Substack', hosts: ['substack.com'] },
  { platform: 'medium', label: 'Medium', hosts: ['medium.com'] },
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]['platform'] | 'website';
export interface SocialLink {
  platform: SocialPlatform;
  label: string;
  url: string;
}

/** Older stored form, read in this order. */
const LEGACY_KEYS = ['website', 'instagram', 'linkedin', 'facebook', 'x', 'tiktok', 'youtube'];

export function describeSocialLink(url: string): SocialLink {
  const host = new URL(url).hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');
  const match = SOCIAL_PLATFORMS.find((p) => p.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
  return match ? { platform: match.platform, label: match.label, url } : { platform: 'website', label: 'Website', url };
}

function cleanHttps(value: unknown, position: number): string {
  const what = `Link ${position}`;
  if (typeof value !== 'string') throw new BadRequestException(`${what} must be a link`);
  const raw = value.trim();
  if (raw.length > MAX_URL_LENGTH) throw new BadRequestException(`${what} is too long`);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException(`${what} must be a full link starting with https://`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) {
    throw new BadRequestException(`${what} must be a full link starting with https://`);
  }
  return url.toString();
}

/** What PATCH accepts: a list of links (blanks dropped, duplicates merged). Null or empty clears them. */
export function normaliseSocialLinks(input: unknown): string[] | null {
  if (input === null) return null;
  if (!Array.isArray(input)) throw new BadRequestException('socialLinks must be a list of links');
  const out: string[] = [];
  input.forEach((value, i) => {
    if (typeof value === 'string' && !value.trim()) return;
    const url = cleanHttps(value, i + 1);
    if (!out.includes(url)) out.push(url);
  });
  if (out.length > MAX_SOCIAL_LINKS) throw new BadRequestException(`Add up to ${MAX_SOCIAL_LINKS} links`);
  return out.length ? out : null;
}

/** The stored links, as https URLs, whichever form they were saved in. Never throws. */
export function readSocialLinks(stored: unknown): string[] {
  let values: unknown[] = [];
  if (Array.isArray(stored)) values = stored;
  else if (stored && typeof stored === 'object') {
    const rec = stored as Record<string, unknown>;
    values = LEGACY_KEYS.map((k) => rec[k]);
  }
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== 'string' || !v.startsWith('https://')) continue;
    try {
      const url = new URL(v);
      if (url.protocol === 'https:' && !url.username && !url.password && !out.includes(url.toString())) out.push(url.toString());
    } catch {
      // skip a malformed stored value
    }
    if (out.length === MAX_SOCIAL_LINKS) break;
  }
  return out;
}
