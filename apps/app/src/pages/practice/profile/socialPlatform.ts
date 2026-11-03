/**
 * Which site a link points to, for the editor's label while typing. The API
 * decides what is shown publicly (apps/api practitioner-profile/social-links.ts);
 * a test there keeps this list the same as its own.
 */
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

/** The label for a link as typed so far; null until it looks like an https link. */
export function linkLabel(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !url.hostname.includes('.')) return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');
  const match = SOCIAL_PLATFORMS.find((p) => p.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
  return match ? match.label : `Website · ${host}`;
}
