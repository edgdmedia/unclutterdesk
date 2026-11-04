import type { ProfilesConfig } from './config';

/** The public profile DTO (apps/api public-profile.service.ts). */
export interface PublicTerm {
  key: string;
  label: string;
}
export interface PublicProfile {
  handle: string;
  displayName: string;
  kind: string;
  pronouns: string | null;
  photoUrl: string | null;
  previewImageUrl: string | null;
  headline: string | null;
  about: string | null;
  approach: string | null;
  credentialsText: string | null;
  supervisedBy: string | null;
  city: string | null;
  countryCode: string;
  offersOnline: boolean;
  offersInPerson: boolean;
  acceptingClients: boolean;
  faithIntegration: string | null;
  yearsInPractice: number | null;
  feeRangeText: string | null;
  bookingMode: 'NONE' | 'DESK' | 'EXTERNAL';
  externalBookingUrl: string | null;
  /** DESK mode: the practice's booking page. */
  deskBookingUrl?: string | null;
  contactEmail: string | null;
  /** List form from the API; the older keyed form is still accepted (see socialItems). */
  socialLinks: SocialLink[] | Record<string, string>;
  themeKey: string;
  /** The custom colour when themeKey is 'custom' (Starter and up). */
  brandColor?: string | null;
  layoutKey: string;
  specialties: (PublicTerm & { primary: boolean })[];
  modalities: PublicTerm[];
  populations: PublicTerm[];
  languages: PublicTerm[];
  timeline: { type: string; title: string; organisation: string | null; startYear: number | null; endYear: number | null; description: string | null }[];
  publishedAt: string | null;
  updatedAt: string;
}

export type ProfileLookup =
  | { kind: 'found'; profile: PublicProfile }
  | { kind: 'moved'; handle: string }
  | { kind: 'gone' }
  | { kind: 'missing' };

const HANDLE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

/**
 * Read one profile from the public API. No cookies, no Authorization, no
 * credentials of any kind are ever sent (§4.3 #1): the renderer is the same
 * for every visitor. `fetchImpl` is the network, so tests can stand in for it.
 */
export async function lookupProfile(config: ProfilesConfig, rawHandle: string, fetchImpl: typeof fetch = fetch): Promise<ProfileLookup> {
  const handle = rawHandle.toLowerCase();
  if (!HANDLE.test(handle)) return { kind: 'missing' };
  // A fresh request: nothing from the visitor's request (cookies,
  // Authorization) is ever forwarded. 'manual' because Workers don't support
  // 'error'; any redirect from the API is treated as a failure below.
  const res = await fetchImpl(`${config.apiOrigin}/v1/profiles/${handle}`, {
    headers: { accept: 'application/json' },
    redirect: 'manual',
  });
  if (res.status === 404) return { kind: 'missing' };
  if (res.status === 410) return { kind: 'gone' };
  if (!res.ok) throw new Error(`Profile API answered ${res.status}`);
  const body = (await res.json()) as { profile?: PublicProfile; redirectTo?: string };
  if (body.redirectTo && HANDLE.test(body.redirectTo)) return { kind: 'moved', handle: body.redirectTo };
  if (body.profile) return { kind: 'found', profile: body.profile };
  return { kind: 'missing' };
}

export async function sitemapEntries(config: ProfilesConfig, fetchImpl: typeof fetch = fetch) {
  const res = await fetchImpl(`${config.apiOrigin}/v1/profiles/sitemap`, { headers: { accept: 'application/json' }, redirect: 'manual' });
  if (!res.ok) throw new Error(`Sitemap API answered ${res.status}`);
  return (await res.json()) as { handle: string; updatedAt: string }[];
}

export const KIND_TITLES: Record<string, string> = {
  COUNSELLOR: 'Counsellor',
  PSYCHOTHERAPIST: 'Psychotherapist',
  PSYCHOLOGIST: 'Psychologist',
  PSYCHIATRIST: 'Psychiatrist',
  SOCIAL_WORKER: 'Social worker',
  TRAINEE: 'Trainee counsellor',
};

/** schema.org Person (§6.11): name, job title, languages, place, image. No reviews or ratings. */
export function personJsonLd(profile: PublicProfile, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.displayName,
    jobTitle: KIND_TITLES[profile.kind] ?? 'Therapist',
    url,
    ...(profile.headline ? { description: profile.headline } : {}),
    ...(profile.photoUrl ? { image: profile.photoUrl } : {}),
    knowsLanguage: profile.languages.map((l) => l.label),
    address: { '@type': 'PostalAddress', addressCountry: profile.countryCode, ...(profile.city ? { addressLocality: profile.city } : {}) },
  };
}

export interface SocialLink {
  platform: string;
  label: string;
  url: string;
}

const LEGACY_LABELS: Record<string, string> = { website: 'Website', instagram: 'Instagram', linkedin: 'LinkedIn', facebook: 'Facebook', x: 'X', tiktok: 'TikTok', youtube: 'YouTube' };

/**
 * The profile's links, safe to render: https only, at most 8. A website is
 * labelled by its domain, so two websites read differently.
 */
export function socialItems(links: PublicProfile['socialLinks'], safe: (u: unknown) => string | null): SocialLink[] {
  const list: SocialLink[] = Array.isArray(links)
    ? links
    : Object.entries(links ?? {}).map(([platform, url]) => ({ platform, label: LEGACY_LABELS[platform] ?? 'Website', url }));
  const out: SocialLink[] = [];
  for (const l of list) {
    const url = safe(l?.url);
    if (!url) continue;
    const label = l.platform === 'website' ? new URL(url).hostname.replace(/^www\./, '') : String(l.label);
    out.push({ platform: String(l.platform), label, url });
    if (out.length === 8) break;
  }
  return out;
}
