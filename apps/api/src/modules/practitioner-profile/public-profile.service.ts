import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { HANDLE_PATTERN, normalizeHandle } from './handles';
import { tenantWebOrigin } from '../../common/origins';
import { describeSocialLink, readSocialLinks, type SocialLink } from './social-links';
import { CUSTOM_THEME, themePalette, type ThemePalette } from './themes';

/**
 * What the public-profile site may read (spec §6.11). No auth, no cookies.
 *
 * The response is an explicit allow-list built field by field, never a
 * serialised Prisma model: no account email, phone, userId, internal ids,
 * tenant internals, storage keys or exact experience counts. Only PUBLISHED
 * profiles are readable. An old handle answers with where it moved; a
 * suspended profile answers 410; everything else is 404, with no hint
 * whether a draft exists.
 */

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
  /** DESK: the main place's booking page. Null in any other mode, or with no place (shown as contact only). */
  deskBookingUrl: string | null;
  contactEmail: string | null;
  socialLinks: SocialLink[];
  themeKey: string;
  /** The custom colour, when themeKey is 'custom'; null otherwise. */
  brandColor: string | null;
  /** The resolved palette colours (custom colour already made readable). */
  colors: ThemePalette;
  layoutKey: string;
  specialties: (PublicTerm & { primary: boolean })[];
  modalities: PublicTerm[];
  populations: PublicTerm[];
  languages: PublicTerm[];
  timeline: { type: string; title: string; organisation: string | null; startYear: number | null; endYear: number | null; description: string | null }[];
  publishedAt: string | null;
  updatedAt: string;
}

export type PublicProfileResult = { profile: PublicProfile } | { redirectTo: string };


@Injectable()
export class PublicProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async byHandle(input: string): Promise<PublicProfileResult> {
    const handle = normalizeHandle(input);
    if (!HANDLE_PATTERN.test(handle)) throw new NotFoundException('Profile not found');

    const profile = await this.prisma.practitionerProfile.findUnique({
      where: { handle },
      include: {
        taxonomy: { include: { term: { select: { kind: true, key: true, label: true, sortOrder: true, isActive: true } } } },
        timeline: { orderBy: { sortOrder: 'asc' } },
        places: { where: { isMain: true }, select: { tenant: { select: { slug: true, customDomain: true, customDomainStatus: true } } } },
      },
    });

    if (!profile) {
      const moved = await this.prisma.practitionerHandleHistory.findUnique({
        where: { handle },
        select: { profile: { select: { handle: true, status: true } } },
      });
      if (moved?.profile.status === 'PUBLISHED') return { redirectTo: moved.profile.handle };
      throw new NotFoundException('Profile not found');
    }
    if (profile.status === 'SUSPENDED') throw new GoneException('This profile is no longer available');
    if (profile.status !== 'PUBLISHED') throw new NotFoundException('Profile not found');

    const terms = (kind: string) =>
      profile.taxonomy
        .filter((t) => t.term.kind === kind && t.term.isActive)
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.term.sortOrder - b.term.sortOrder)
        .map((t) => ({ key: t.term.key, label: t.term.label, primary: t.isPrimary }));
    const plain = (list: (PublicTerm & { primary: boolean })[]) => list.map(({ key, label }) => ({ key, label }));

    const socialLinks = readSocialLinks(profile.socialLinks).map(describeSocialLink);
    const publicUrl = (key: string | null) => (key && this.storage.configured('public') ? this.storage.publicUrl(key) : null);

    return {
      profile: {
        handle: profile.handle,
        displayName: profile.displayName,
        kind: profile.kind,
        pronouns: profile.pronouns,
        photoUrl: publicUrl(profile.photoKey),
        previewImageUrl: publicUrl(profile.previewImageKey),
        headline: profile.headline,
        about: profile.about,
        approach: profile.approach,
        credentialsText: profile.credentialsText,
        supervisedBy: profile.supervisedBy,
        city: profile.city,
        countryCode: profile.countryCode,
        offersOnline: profile.offersOnline,
        offersInPerson: profile.offersInPerson,
        acceptingClients: profile.acceptingClients,
        faithIntegration: profile.faithIntegration,
        yearsInPractice: profile.selfReportedYears,
        feeRangeText: profile.feeRangeText,
        bookingMode: profile.bookingMode,
        externalBookingUrl: profile.bookingMode === 'EXTERNAL' && profile.externalBookingUrl?.startsWith('https://') ? profile.externalBookingUrl : null,
        deskBookingUrl: profile.bookingMode === 'DESK' && profile.places[0] ? `${tenantWebOrigin(profile.places[0].tenant)}/book` : null,
        contactEmail: profile.contactEmailPublic,
        socialLinks,
        themeKey: profile.themeKey,
        brandColor: profile.themeKey === CUSTOM_THEME ? profile.brandColor : null,
        colors: themePalette(profile.themeKey, profile.brandColor),
        layoutKey: profile.layoutKey,
        specialties: terms('SPECIALTY'),
        modalities: plain(terms('MODALITY')),
        populations: plain(terms('POPULATION')),
        languages: plain(terms('LANGUAGE')),
        timeline: profile.timeline.map((e) => ({
          type: e.type,
          title: e.title,
          organisation: e.organisation,
          startYear: e.startYear,
          endYear: e.endYear,
          description: e.description,
        })),
        publishedAt: profile.publishedAt?.toISOString() ?? null,
        updatedAt: profile.updatedAt.toISOString(),
      },
    };
  }

  /** Every published handle with its last change, for sitemap.xml. */
  async sitemap() {
    const rows = await this.prisma.practitionerProfile.findMany({
      where: { status: 'PUBLISHED' },
      select: { handle: true, updatedAt: true },
      orderBy: { handle: 'asc' },
    });
    return rows.map((r) => ({ handle: r.handle, updatedAt: r.updatedAt.toISOString() }));
  }
}
