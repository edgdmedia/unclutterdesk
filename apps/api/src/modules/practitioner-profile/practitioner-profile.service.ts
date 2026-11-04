import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, type PractitionerKind } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { randomBytes } from 'node:crypto';
import { JobsService } from '../jobs/jobs.service';
import { decodeImageDataUrl } from '../storage/images';
import { StorageService } from '../storage/storage.service';
import {
  PUBLISH_BLOCKER_MESSAGES,
  SECTION_ORDER,
  SECTION_WEIGHTS,
  completenessScore,
  nextSection,
  publishBlockers,
  sectionScores,
  type ProfileSnapshot,
  type SectionKey,
} from './completeness';
import { isLayoutKey, isThemeKey, normaliseThemeKey } from './themes';
import { PRACTITIONER_KINDS, PRACTITIONER_KIND_LABELS } from './kinds';
import { PROFILE_PUBLIC_ORIGIN, tenantWebOrigin } from '../../common/origins';
import { normaliseSocialLinks, readSocialLinks } from './social-links';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { profileQr } from './share/qr';
import { renderProfilePdf } from './share/profile-pdf';
import { writingTips } from './writing-tips';
import { HANDLE_MESSAGES, handleProblem, normalizeHandle, suggestHandle } from './handles';
import { PHOTO_BACKFILL_JOB, type PhotoBackfillPayload } from './profile-photo.job';
import { SITEMAP_TAG, profileTag, queuePurge } from './profile-purge.job';
import { PREVIEW_JOB, type PreviewPayload } from './profile-preview.job';

/**
 * A therapist's own public profile (spec §6.1).
 *
 * Profiles are global, not tenant-scoped: one per person, whatever practices
 * they work at. Every method here acts on the profile of the signed-in user
 * and nobody else's, by `userId` from the session; drafts are never readable
 * by anyone else. practitioner-profile.access.spec.ts holds every query in
 * this file to that rule. Platform admins act on profiles from the admin
 * module, not through these methods.
 */

export { PRACTITIONER_KINDS, PRACTITIONER_KIND_LABELS } from './kinds';

/** Plain-text fields and their limits (§6.1). Text is stored as typed; the renderer escapes it. */
const TEXT_LIMITS = {
  displayName: 80,
  pronouns: 40,
  headline: 120,
  about: 2000,
  approach: 1500,
  credentialsText: 1000,
  city: 80,
  faithIntegration: 300,
  supervisedBy: 120,
  selfReportedClientsBucket: 20,
  feeRangeText: 120,
} as const;

type TextField = keyof typeof TEXT_LIMITS;

const BOOLEAN_FIELDS = ['offersOnline', 'offersInPerson', 'acceptingClients', 'showPlatformExperience'] as const;
type BooleanField = (typeof BOOLEAN_FIELDS)[number];

/** Fields a therapist edits with PATCH /v1/profile/me. Handle, status and booking mode have their own flows. */
export type ProfileUpdateInput = Partial<Record<TextField, string | null>> &
  Partial<Record<BooleanField, boolean>> & {
    kind?: PractitionerKind;
    countryCode?: string;
    selfReportedYears?: number | null;
    contactEmailPublic?: string | null;
    /** Up to 8 https links, any site (social-links.ts). */
    socialLinks?: string[] | null;
  };

/** Fields that also choose appearance or starting content. */
export type ProfileAppearanceInput = { themeKey?: string; layoutKey?: string; templateKey?: string | null };

export interface TimelineInput {
  type: string;
  title: string;
  organisation?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  description?: string | null;
}

export const TIMELINE_TYPES = ['EDUCATION', 'TRAINING', 'PRACTICE', 'SUPERVISION', 'MEMBERSHIP', 'MILESTONE'] as const;
export const MAX_TIMELINE_ENTRIES = 30;

/** Free text a template's example may have been inserted into, by section (§6.6). */
const TEMPLATE_TEXT_FIELDS: Partial<Record<SectionKey, 'headline' | 'about' | 'approach' | 'credentialsText' | 'faithIntegration'>> = {
  identity: 'headline',
  about: 'about',
  approach: 'approach',
  qualifications: 'credentialsText',
  population: 'faithIntegration',
};

const squash = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

export interface ProfileCreateInput {
  handle?: string;
  kind?: PractitionerKind;
  displayName?: string;
}

export interface TaxonomySelection {
  termId: string;
  isPrimary?: boolean;
}

export const MAX_PRIMARY_SPECIALTIES = 3;

const OWN_PROFILE_INCLUDE = {
  taxonomy: { include: { term: true } },
  timeline: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.PractitionerProfileInclude;

function httpsUrl(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a link`);
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new BadRequestException(`${field} must be a full link starting with https://`);
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new BadRequestException(`${field} must be a full link starting with https://`);
  }
  return url.toString();
}

function boundedText(value: unknown, field: TextField): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be text`);
  const text = value.replace(/\r\n/g, '\n').trim();
  if (text.length > TEXT_LIMITS[field]) {
    throw new BadRequestException(`${field} can be at most ${TEXT_LIMITS[field]} characters`);
  }
  return text || null;
}

@Injectable()
export class PractitionerProfileService {
  private readonly logger = new Logger(PractitionerProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly storage: StorageService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * Whether `input` can be this user's handle: well-formed, not reserved, and
   * held by nobody else, now or in the past (old handles redirect forever, §6.2).
   */
  async handleAvailability(userId: bigint, input: string) {
    const handle = normalizeHandle(input);
    const problem = handleProblem(handle);
    if (problem) return { handle, available: false, reason: problem, message: HANDLE_MESSAGES[problem] };

    const [current, past] = await Promise.all([
      this.prisma.practitionerProfile.findUnique({ where: { handle }, select: { userId: true } }),
      this.prisma.practitionerHandleHistory.findUnique({
        where: { handle },
        select: { profile: { select: { userId: true } } },
      }),
    ]);
    const holder = current?.userId ?? past?.profile.userId;
    if (holder !== undefined && holder !== userId) {
      return { handle, available: false, reason: 'taken' as const, message: HANDLE_MESSAGES.taken };
    }
    return { handle, available: true as const };
  }

  /** The signed-in user's own profile, drafts included, or null before they have one. */
  async getOwn(userId: bigint) {
    const profile = await this.prisma.practitionerProfile.findUnique({ where: { userId }, include: OWN_PROFILE_INCLUDE });
    return profile ? { ...profile, socialLinks: readSocialLinks(profile.socialLinks) } : null;
  }

  /**
   * How clients book (§6.9), with what the editor needs to offer each choice:
   * DESK is only possible once the practice the therapist is signed into can
   * take bookings (an active service and open times for them).
   */
  async getBooking(userId: bigint, therapistProfileId: bigint) {
    const profile = await this.prisma.practitionerProfile.findUnique({
      where: { userId },
      select: { bookingMode: true, externalBookingUrl: true, places: { where: { isMain: true }, select: { tenant: { select: { slug: true, customDomain: true, customDomainStatus: true } } } } },
    });
    if (!profile) throw new NotFoundException('You have no profile yet');
    const desk = await this.deskReadiness(therapistProfileId);
    const main = profile.places[0]?.tenant;
    return {
      mode: profile.bookingMode,
      externalBookingUrl: profile.externalBookingUrl,
      deskReady: desk.ready,
      deskMissing: desk.missing,
      deskBookingUrl: profile.bookingMode === 'DESK' && main ? `${tenantWebOrigin(main)}/book` : null,
    };
  }

  /** Can clients book this therapist in this practice? Lists what's missing, in set-up order. */
  private async deskReadiness(therapistProfileId: bigint): Promise<{ ready: boolean; missing: ('service' | 'availability')[]; tenantId: bigint | null }> {
    const member = await this.prisma.consultTherapistProfile.findUnique({ where: { profileId: therapistProfileId }, select: { profile: { select: { tenantId: true } } } });
    const tenantId = member?.profile.tenantId ?? null;
    if (!tenantId) return { ready: false, missing: ['service', 'availability'], tenantId: null };
    const [services, slots] = await Promise.all([
      this.prisma.consultService.count({ where: { tenantId, isActive: true } }),
      this.prisma.consultAvailability.count({ where: { tenantId, providerProfileId: therapistProfileId, isActive: true, startsAt: { gt: new Date() } } }),
    ]);
    const missing = [...(services ? [] : (['service'] as const)), ...(slots ? [] : (['availability'] as const))];
    return { ready: missing.length === 0, missing, tenantId };
  }

  /**
   * Choose how clients book: through the practice (DESK), a link elsewhere
   * (EXTERNAL) or contact only (NONE). DESK makes the signed-in practice this
   * profile's main place and switches the dashboard to the full practice view.
   */
  async setBooking(userId: bigint, therapistProfileId: bigint, input: { mode?: unknown; externalBookingUrl?: unknown }) {
    const own = await this.requireOwn(userId);
    const mode = input.mode;
    if (mode !== 'NONE' && mode !== 'DESK' && mode !== 'EXTERNAL') throw new BadRequestException('Choose how clients book');

    if (mode === 'EXTERNAL') {
      if (input.externalBookingUrl === undefined || input.externalBookingUrl === null || input.externalBookingUrl === '') {
        throw new BadRequestException('Add the link where clients book you');
      }
      const url = httpsUrl(input.externalBookingUrl, 'Booking link');
      await this.prisma.practitionerProfile.update({ where: { userId }, data: { bookingMode: 'EXTERNAL', externalBookingUrl: url } });
    } else if (mode === 'NONE') {
      await this.prisma.practitionerProfile.update({ where: { userId }, data: { bookingMode: 'NONE' } });
    } else {
      const desk = await this.deskReadiness(therapistProfileId);
      if (!desk.ready || !desk.tenantId) {
        throw new ConflictException({ message: 'Set up booking first: add a service and your open times', code: 'DESK_NOT_READY', missing: desk.missing });
      }
      const tenantId = desk.tenantId;
      await this.prisma.$transaction(async (tx) => {
        await tx.practitionerPlace.updateMany({ where: { profileId: own.id }, data: { isMain: false } });
        await tx.practitionerPlace.upsert({
          where: { profileId_therapistProfileId: { profileId: own.id, therapistProfileId } },
          create: { profileId: own.id, tenantId, therapistProfileId, isMain: true },
          update: { isMain: true },
        });
        await tx.practitionerProfile.update({ where: { userId }, data: { bookingMode: 'DESK' } });
        await tx.tenant.update({ where: { id: tenantId }, data: { onboardingIntent: 'PRACTICE' } });
      });
    }

    await this.refreshOwnScore(userId);
    await this.purgeIfPublished(userId);
    return this.getBooking(userId, therapistProfileId);
  }

  /**
   * Start the signed-in practitioner's profile as a DRAFT, filled from what
   * their practice already holds about them (§6.1 back-fill): tagline,
   * credentials, years of experience, online/in-person, and taxonomy terms
   * matching their specialty, modalities and languages. The old fields are
   * left as they are. The practice photo is copied to R2 by a background job
   * (profile-photo.job.ts), so a slow or unconfigured R2 never blocks signup.
   */
  async createOwn(userId: bigint, therapistProfileId: bigint, input: ProfileCreateInput) {
    const existing = await this.prisma.practitionerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (existing) throw new ConflictException('You already have a profile');

    const therapist = await this.prisma.consultTherapistProfile.findFirst({
      where: { profileId: therapistProfileId, profile: { userId } },
      include: { profile: { select: { firstName: true, lastName: true } } },
    });
    if (!therapist) throw new ForbiddenException('Only practitioners can create a profile');

    const kind = input.kind ?? 'COUNSELLOR';
    if (!PRACTITIONER_KINDS.includes(kind)) throw new BadRequestException('Unknown practitioner type');

    const fullName = [therapist.profile.firstName, therapist.profile.lastName].filter(Boolean).join(' ').trim();
    const displayName = boundedText(input.displayName ?? fullName, 'displayName');
    if (!displayName) throw new BadRequestException('Add the name clients will see');

    const requested = input.handle ?? suggestHandle(displayName);
    const availability = await this.handleAvailability(userId, requested);
    if (!availability.available) throw new BadRequestException(availability.message);

    const termIds = await this.matchingTerms({
      SPECIALTY: therapist.specialty ? therapist.specialty.split(/[,;/]/) : [],
      MODALITY: therapist.modalities,
      LANGUAGE: therapist.languages,
    });

    let created;
    try {
      created = await this.prisma.practitionerProfile.create({
        data: {
          userId,
          handle: availability.handle,
          kind,
          displayName,
          headline: therapist.tagline?.trim().slice(0, TEXT_LIMITS.headline) || null,
          credentialsText: therapist.credentials?.trim().slice(0, TEXT_LIMITS.credentialsText) || null,
          selfReportedYears: therapist.yearsExperience ?? null,
          // §6.17: the practice welcome message was the only "about" there was.
          about: therapist.welcomeMessage?.trim().slice(0, TEXT_LIMITS.about) || null,
          offersOnline: therapist.offersOnline,
          offersInPerson: therapist.offersInPerson,
          taxonomy: { create: termIds.map((termId) => ({ termId })) },
        },
        include: OWN_PROFILE_INCLUDE,
      });
    } catch (err) {
      // Two requests for one handle, or a double-submit: the unique index decides.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(HANDLE_MESSAGES.taken);
      }
      throw err;
    }

    const payload: PhotoBackfillPayload = { practitionerProfileId: String(created.id), sourceProfileId: String(therapistProfileId) };
    await this.jobs.enqueue(PHOTO_BACKFILL_JOB, payload as never, { dedupeKey: `${PHOTO_BACKFILL_JOB}:${created.id}` });
    await this.refreshOwnScore(userId);
    await this.purgeIfPublished(userId);
    return this.getOwn(userId);
  }

  /**
   * §6.17: make sure this therapist has a profile, the one home for the facts
   * about them. Creates an unpublished DRAFT, filled from their practice
   * record, with a handle made from their name (then -2, -3 … until free).
   * Does nothing if they already have one. Publishing stays their choice.
   */
  async ensureDraft(userId: bigint, therapistProfileId: bigint): Promise<{ created: boolean }> {
    const existing = await this.prisma.practitionerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (existing) return { created: false };
    const therapist = await this.prisma.consultTherapistProfile.findFirst({
      where: { profileId: therapistProfileId, profile: { userId } },
      select: { profile: { select: { firstName: true, lastName: true } } },
    });
    if (!therapist) return { created: false };
    const name = [therapist.profile.firstName, therapist.profile.lastName].filter(Boolean).join(' ').trim() || 'Therapist';
    const base = suggestHandle(name) || 'therapist';
    for (let n = 1; n <= 99; n++) {
      const suffix = n === 1 ? '' : `-${n}`;
      const candidate = `${base.slice(0, 30 - suffix.length).replace(/-+$/, '')}${suffix}`;
      const free = await this.handleAvailability(userId, candidate);
      if (!free.available) continue;
      try {
        await this.createOwn(userId, therapistProfileId, { handle: free.handle, displayName: name });
        return { created: true };
      } catch (err) {
        if (err instanceof ConflictException) {
          // Taken a moment ago by someone else, or this person was given one meanwhile.
          if (await this.prisma.practitionerProfile.findUnique({ where: { userId }, select: { id: true } })) return { created: false };
          continue;
        }
        throw err;
      }
    }
    throw new ConflictException('Could not find a free profile address for this therapist');
  }

  /** Change the signed-in user's own profile fields. */
  async updateOwn(userId: bigint, input: ProfileUpdateInput & ProfileAppearanceInput) {
    const data: Prisma.PractitionerProfileUpdateInput = {};

    if ('themeKey' in input) {
      const themeKey = normaliseThemeKey(input.themeKey);
      if (!isThemeKey(themeKey)) throw new BadRequestException('Unknown theme');
      data.themeKey = themeKey;
    }
    if ('layoutKey' in input) {
      if (!isLayoutKey(input.layoutKey)) throw new BadRequestException('Unknown layout');
      data.layoutKey = input.layoutKey;
    }
    if ('templateKey' in input) {
      if (input.templateKey === null) {
        data.templateKey = null;
      } else {
        const template = await this.prisma.profileTemplate.findFirst({
          where: { key: String(input.templateKey), isActive: true },
          select: { key: true },
        });
        if (!template) throw new BadRequestException('Unknown template');
        data.templateKey = template.key;
      }
    }

    for (const field of Object.keys(TEXT_LIMITS) as TextField[]) {
      if (field in input) data[field] = boundedText(input[field], field) as never;
    }
    if ('displayName' in input && !data.displayName) throw new BadRequestException('Add the name clients will see');

    for (const field of BOOLEAN_FIELDS) {
      if (field in input) {
        if (typeof input[field] !== 'boolean') throw new BadRequestException(`${field} must be true or false`);
        data[field] = input[field];
      }
    }

    if ('kind' in input) {
      if (!input.kind || !PRACTITIONER_KINDS.includes(input.kind)) throw new BadRequestException('Unknown practitioner type');
      data.kind = input.kind;
    }
    if ('countryCode' in input) {
      if (typeof input.countryCode !== 'string' || !/^[A-Za-z]{2}$/.test(input.countryCode)) {
        throw new BadRequestException('countryCode must be a two-letter country code');
      }
      data.countryCode = input.countryCode.toUpperCase();
    }
    if ('selfReportedYears' in input) {
      const years = input.selfReportedYears;
      if (years !== null && (!Number.isInteger(years) || (years as number) < 0 || (years as number) > 70)) {
        throw new BadRequestException('Years of experience must be a whole number from 0 to 70');
      }
      data.selfReportedYears = years ?? null;
    }
    if ('contactEmailPublic' in input) {
      const email = input.contactEmailPublic?.trim() || null;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter a valid email address');
      data.contactEmailPublic = email;
    }
    if ('socialLinks' in input) {
      const links = normaliseSocialLinks(input.socialLinks);
      data.socialLinks = links ?? Prisma.DbNull;
    }

    await this.requireOwn(userId);
    await this.prisma.practitionerProfile.update({ where: { userId }, data });
    await this.refreshOwnScore(userId);
    await this.purgeIfPublished(userId);
    return this.getOwn(userId);
  }

  /**
   * Move the signed-in user's profile to a new handle. The old one is kept in
   * PractitionerHandleHistory so its links keep working (they 301 to the new
   * one) and nobody else can take it. Going back to one of your own old
   * handles is allowed.
   */
  async changeOwnHandle(userId: bigint, input: string) {
    const profile = await this.requireOwn(userId);
    const availability = await this.handleAvailability(userId, input);
    if (!availability.available) throw new BadRequestException(availability.message);
    if (availability.handle === profile.handle) return this.getOwn(userId);

    try {
      await this.prisma.$transaction([
        this.prisma.practitionerHandleHistory.deleteMany({ where: { handle: availability.handle, profile: { userId } } }),
        this.prisma.practitionerHandleHistory.create({ data: { handle: profile.handle, profileId: profile.id } }),
        this.prisma.practitionerProfile.update({ where: { userId }, data: { handle: availability.handle } }),
      ]);
      await this.purge([profileTag(profile.handle), profileTag(availability.handle), SITEMAP_TAG]);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(HANDLE_MESSAGES.taken);
      }
      throw err;
    }
    return this.getOwn(userId);
  }

  /** Replace the signed-in user's taxonomy: active terms only, at most three primary specialties. */
  async setOwnTaxonomy(userId: bigint, selections: TaxonomySelection[]) {
    if (!Array.isArray(selections)) throw new BadRequestException('Send a list of terms');
    if (selections.length > 60) throw new BadRequestException('Choose at most 60 terms');

    let ids: bigint[];
    try {
      ids = selections.map((s) => BigInt(s.termId));
    } catch {
      throw new BadRequestException('Unknown term');
    }
    if (new Set(ids.map(String)).size !== ids.length) throw new BadRequestException('A term is listed twice');

    const terms = await this.prisma.taxonomyTerm.findMany({ where: { id: { in: ids }, isActive: true } });
    if (terms.length !== ids.length) throw new BadRequestException('Unknown term');
    const kindOf = new Map(terms.map((t) => [String(t.id), t.kind]));

    const primary = selections.filter((s) => s.isPrimary);
    if (primary.some((s) => kindOf.get(String(BigInt(s.termId))) !== 'SPECIALTY')) {
      throw new BadRequestException('Only specialties can be primary');
    }
    if (primary.length > MAX_PRIMARY_SPECIALTIES) {
      throw new BadRequestException(`Choose at most ${MAX_PRIMARY_SPECIALTIES} primary specialties`);
    }

    const profile = await this.requireOwn(userId);
    await this.prisma.$transaction([
      this.prisma.practitionerTaxonomy.deleteMany({ where: { profileId: profile.id, profile: { userId } } }),
      this.prisma.practitionerTaxonomy.createMany({
        data: selections.map((s) => ({ profileId: profile.id, termId: BigInt(s.termId), isPrimary: Boolean(s.isPrimary) })),
      }),
    ]);
    await this.refreshOwnScore(userId);
    await this.purgeIfPublished(userId);
    return this.getOwn(userId);
  }

  /** Replace the signed-in user's training & journey timeline (§6.4 section 3). */
  async setOwnTimeline(userId: bigint, entries: TimelineInput[]) {
    if (!Array.isArray(entries)) throw new BadRequestException('Send a list of entries');
    if (entries.length > MAX_TIMELINE_ENTRIES) throw new BadRequestException(`Add at most ${MAX_TIMELINE_ENTRIES} entries`);
    const thisYear = new Date().getFullYear();
    const year = (value: unknown, label: string) => {
      if (value === null || value === undefined || value === '') return null;
      if (!Number.isInteger(value) || (value as number) < 1950 || (value as number) > thisYear + 1) {
        throw new BadRequestException(`${label} must be a year between 1950 and ${thisYear + 1}`);
      }
      return value as number;
    };
    const short = (value: unknown, label: string, max: number) => {
      if (value === null || value === undefined) return null;
      if (typeof value !== 'string') throw new BadRequestException(`${label} must be text`);
      const text = value.trim();
      if (text.length > max) throw new BadRequestException(`${label} can be at most ${max} characters`);
      return text || null;
    };

    const rows = entries.map((e, i) => {
      if (!(TIMELINE_TYPES as readonly string[]).includes(e?.type)) throw new BadRequestException('Unknown timeline entry type');
      const title = short(e.title, 'Title', 120);
      if (!title) throw new BadRequestException('Each entry needs a title');
      const startYear = year(e.startYear, 'Start year');
      const endYear = year(e.endYear, 'End year');
      if (startYear !== null && endYear !== null && endYear < startYear) throw new BadRequestException('An entry ends before it starts');
      return {
        type: e.type,
        title,
        organisation: short(e.organisation, 'Organisation', 120),
        startYear,
        endYear,
        description: short(e.description, 'Description', 500),
        sortOrder: i,
      };
    });

    const profile = await this.requireOwn(userId);
    await this.prisma.$transaction([
      this.prisma.practitionerTimelineEntry.deleteMany({ where: { profileId: profile.id, profile: { userId } } }),
      this.prisma.practitionerTimelineEntry.createMany({ data: rows.map((r) => ({ ...r, profileId: profile.id })) }),
    ]);
    await this.refreshOwnScore(userId);
    await this.purgeIfPublished(userId);
    await this.purgeIfPublished(userId);
    return this.getOwn(userId);
  }

  /**
   * Set the signed-in user's photo from an image the app has encoded (a data
   * URL). The bytes must really be a JPEG, PNG or WebP within the size limit.
   * Each upload gets a new key, so the old file is removed after the switch.
   */
  async setOwnPhoto(userId: bigint, image: unknown) {
    if (typeof image !== 'string') throw new BadRequestException('Choose an image');
    const decoded = decodeImageDataUrl(image);
    if ('problem' in decoded) {
      throw new BadRequestException(
        decoded.problem === 'size' ? 'That photo is too large. Choose one under 2 MB.' : 'Choose a JPEG, PNG or WebP photo.',
      );
    }
    if (!this.storage.configured('public')) throw new ServiceUnavailableException('Photo upload is not available yet.');

    const profile = await this.prisma.practitionerProfile.findUnique({ where: { userId }, select: { id: true, photoKey: true } });
    if (!profile) throw new NotFoundException('You have no profile yet');

    const key = `profiles/${profile.id}/photo-${randomBytes(8).toString('hex')}.${decoded.extension}`;
    await this.storage.put('public', key, decoded.bytes, { contentType: decoded.contentType });
    await this.prisma.practitionerProfile.update({ where: { userId }, data: { photoKey: key } });
    if (profile.photoKey) await this.removeQuietly(profile.photoKey);
    await this.refreshOwnScore(userId);
    await this.purgeIfPublished(userId);
    return this.getOwn(userId);
  }

  async removeOwnPhoto(userId: bigint) {
    const profile = await this.prisma.practitionerProfile.findUnique({ where: { userId }, select: { photoKey: true } });
    if (!profile) throw new NotFoundException('You have no profile yet');
    if (profile.photoKey) {
      await this.prisma.practitionerProfile.update({ where: { userId }, data: { photoKey: null } });
      await this.removeQuietly(profile.photoKey);
      await this.refreshOwnScore(userId);
    await this.purgeIfPublished(userId);
    }
    return this.getOwn(userId);
  }

  /**
   * Everything the editor shows beside the form (§6.7): the score by section,
   * the next thing to add, what still blocks publishing, writing tips, and
   * sections still holding unchanged template text (§6.6).
   */
  async ownChecklist(userId: bigint) {
    const loaded = await this.loadOwnSnapshot(userId);
    if (!loaded) throw new NotFoundException('You have no profile yet');
    const { snapshot, profile } = loaded;

    const scores = sectionScores(snapshot);
    const blockers = publishBlockers(snapshot);
    return {
      score: completenessScore(snapshot),
      sections: SECTION_ORDER.map((key) => ({ key, score: scores[key], weight: SECTION_WEIGHTS[key] })),
      next: nextSection(snapshot),
      canPublish: blockers.length === 0,
      blockers: blockers.map((key) => ({ key, message: PUBLISH_BLOCKER_MESSAGES[key] })),
      tips: writingTips({
        headline: profile.headline,
        about: profile.about,
        approach: profile.approach,
        credentialsText: profile.credentialsText,
      }),
      unchangedTemplateText: await this.unchangedTemplateSections(profile),
    };
  }

  /**
   * Publish the signed-in user's profile. Refused while anything in §6.4's
   * "required to publish" is missing, or while an admin has suspended it.
   * Unchanged template text is a warning in the response, never a block.
   */
  async publishOwn(userId: bigint) {
    const checklist = await this.ownChecklist(userId);
    const profile = await this.prisma.practitionerProfile.findUnique({ where: { userId }, select: { status: true, publishedAt: true } });
    if (!profile) throw new NotFoundException('You have no profile yet');
    if (profile.status === 'SUSPENDED') throw new ForbiddenException('This profile has been suspended. Contact support.');
    if (!checklist.canPublish) {
      throw new BadRequestException({ message: 'Your profile is not ready to publish', blockers: checklist.blockers });
    }
    await this.prisma.practitionerProfile.update({
      where: { userId },
      data: { status: 'PUBLISHED', publishedAt: profile.publishedAt ?? new Date() },
    });
    const live = await this.requireOwn(userId);
    await this.purge([profileTag(live.handle), SITEMAP_TAG]);
    await this.queuePreview(live.id);
    return { profile: await this.getOwn(userId), warnings: { unchangedTemplateText: checklist.unchangedTemplateText } };
  }

  /** Take the signed-in user's published profile off the web (HIDDEN). A draft stays a draft. */
  async unpublishOwn(userId: bigint) {
    const profile = await this.prisma.practitionerProfile.findUnique({ where: { userId }, select: { status: true } });
    if (!profile) throw new NotFoundException('You have no profile yet');
    if (profile.status === 'SUSPENDED') throw new ForbiddenException('This profile has been suspended. Contact support.');
    if (profile.status === 'PUBLISHED') {
      await this.prisma.practitionerProfile.update({ where: { userId }, data: { status: 'HIDDEN' } });
      const hidden = await this.requireOwn(userId);
      await this.purge([profileTag(hidden.handle), SITEMAP_TAG]);
    }
    return this.getOwn(userId);
  }

  /**
   * The signed-in user's public address and handle, for the share kit (§6.10).
   * Built from PROFILE_PUBLIC_ORIGIN and the profile's own handle, never from
   * anything the caller sent.
   */
  async shareTarget(userId: bigint): Promise<{ handle: string; url: string }> {
    const profile = await this.prisma.practitionerProfile.findUnique({
      where: { userId },
      select: { handle: true },
    });
    if (!profile) throw new NotFoundException('You have no profile yet');
    return { handle: profile.handle, url: `${PROFILE_PUBLIC_ORIGIN}/${profile.handle}` };
  }

  /**
   * The signed-in user's one-page profile PDF (§6.10). Paid plans only: the
   * entitlement check runs first and throws the 402 before any work is done.
   * The photo is optional — a missing or unreadable one falls back to initials.
   */
  async renderOwnProfilePdf(userId: bigint): Promise<{ pdf: Buffer; filename: string }> {
    await this.entitlements.assertProfile(userId, 'downloadablePdf');

    const profile = await this.prisma.practitionerProfile.findUnique({
      where: { userId },
      include: { taxonomy: { include: { term: true } } },
    });
    if (!profile) throw new NotFoundException('You have no profile yet');

    const url = `${PROFILE_PUBLIC_ORIGIN}/${profile.handle}`;
    const qrPng = (await profileQr(url, 'png')) as Buffer;
    const photo = await this.loadPublicPhoto(profile.photoKey);
    const labelsFor = (kind: string, primaryOnly = false) =>
      profile.taxonomy
        .filter((t) => t.term.kind === kind && (!primaryOnly || t.isPrimary))
        .sort((a, b) => a.term.sortOrder - b.term.sortOrder)
        .map((t) => t.term.label);
    const primary = labelsFor('SPECIALTY', true);

    const pdf = await renderProfilePdf({
      name: profile.displayName,
      kindLabel: PRACTITIONER_KIND_LABELS[profile.kind] ?? 'Practitioner',
      headline: profile.headline,
      place: [profile.city, profile.countryCode].filter(Boolean).join(', '),
      qualifications: profile.credentialsText,
      primarySpecialties: primary.length ? primary : labelsFor('SPECIALTY'),
      specialties: labelsFor('SPECIALTY'),
      languages: labelsFor('LANGUAGE'),
      url,
      qrPng,
      photo,
      themeKey: profile.themeKey,
    });
    return { pdf, filename: `${profile.handle}-profile.pdf` };
  }

  /** A profile photo from the public bucket, or null when it is unset or cannot be read. */
  private async loadPublicPhoto(key: string | null): Promise<Buffer | null> {
    if (!key || !this.storage.configured('public')) return null;
    try {
      return await this.storage.get('public', key);
    } catch (err) {
      this.logger.warn(`could not load profile photo ${key} for the PDF: ${(err as Error).message}`);
      return null;
    }
  }

  /** Active templates for the picker (§6.6), with their guidance and examples. */
  async activeTemplates() {
    return this.prisma.profileTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      select: { key: true, title: true, description: true, kind: true, sections: true },
    });
  }

  /** The active taxonomy, grouped by kind, for the editor's pickers. */
  async activeTaxonomy() {
    const terms = await this.prisma.taxonomyTerm.findMany({
      where: { isActive: true },
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
      select: { id: true, kind: true, key: true, label: true },
    });
    return terms.map((t) => ({ ...t, id: t.id.toString() }));
  }

  private async requireOwn(userId: bigint) {
    const profile = await this.prisma.practitionerProfile.findUnique({
      where: { userId },
      select: { id: true, handle: true },
    });
    if (!profile) throw new NotFoundException('You have no profile yet');
    return profile;
  }

  /** After a change to a published profile, purge its page (§6.12). Drafts and hidden profiles aren't served, so there is nothing to purge. */
  private async purgeIfPublished(userId: bigint) {
    const profile = await this.prisma.practitionerProfile.findUnique({ where: { userId }, select: { id: true, handle: true, status: true } });
    if (profile?.status !== 'PUBLISHED') return;
    await this.purge([profileTag(profile.handle)]);
    await this.queuePreview(profile.id);
  }

  /** Re-render the link-preview image (§6.3) on the next job run; one queued render per profile at a time. */
  private async queuePreview(profileId: bigint) {
    const payload: PreviewPayload = { practitionerProfileId: profileId.toString() };
    await this.jobs.enqueue(PREVIEW_JOB, payload as never, { dedupeKey: `${PREVIEW_JOB}:${profileId}` });
  }

  private async purge(tags: string[]) {
    await queuePurge(this.jobs, tags);
  }

  /** Recompute and store the signed-in user's completeness score (§6.7: on every save). */
  private async refreshOwnScore(userId: bigint) {
    const loaded = await this.loadOwnSnapshot(userId);
    if (!loaded) return;
    await this.prisma.practitionerProfile.update({ where: { userId }, data: { completenessScore: completenessScore(loaded.snapshot) } });
  }

  private async loadOwnSnapshot(userId: bigint): Promise<{ snapshot: ProfileSnapshot; profile: any } | null> {
    const profile = await this.prisma.practitionerProfile.findUnique({
      where: { userId },
      include: {
        taxonomy: { select: { term: { select: { kind: true } } } },
        _count: { select: { timeline: true, places: true } },
      },
    });
    if (!profile) return null;
    const terms = { SPECIALTY: 0, MODALITY: 0, POPULATION: 0, LANGUAGE: 0 };
    for (const t of profile.taxonomy) terms[t.term.kind] += 1;
    const links = readSocialLinks(profile.socialLinks);
    return {
      profile,
      snapshot: {
        displayName: profile.displayName,
        kind: profile.kind,
        headline: profile.headline,
        countryCode: profile.countryCode,
        photoKey: profile.photoKey,
        about: profile.about,
        approach: profile.approach,
        credentialsText: profile.credentialsText,
        timelineCount: profile._count.timeline,
        terms,
        faithIntegration: profile.faithIntegration,
        selfReportedYears: profile.selfReportedYears,
        showPlatformExperience: profile.showPlatformExperience,
        bookingMode: profile.bookingMode,
        placesCount: profile._count.places,
        feeRangeText: profile.feeRangeText,
        externalBookingUrl: profile.externalBookingUrl,
        contactEmailPublic: profile.contactEmailPublic,
        socialLinksCount: links.length,
      },
    };
  }

  /** Sections whose text still contains the chosen template's example word for word (§6.6). */
  private async unchangedTemplateSections(profile: { templateKey: string | null } & Record<string, any>): Promise<SectionKey[]> {
    if (!profile.templateKey) return [];
    const template = await this.prisma.profileTemplate.findUnique({ where: { key: profile.templateKey }, select: { sections: true } });
    const sections = ((template?.sections as any)?.sections ?? {}) as Partial<Record<SectionKey, { example?: string }>>;
    const out: SectionKey[] = [];
    for (const [section, field] of Object.entries(TEMPLATE_TEXT_FIELDS) as [SectionKey, string][]) {
      const example = sections[section]?.example;
      const text = profile[field];
      if (example && typeof text === 'string' && squash(text).includes(squash(example))) out.push(section);
    }
    return out;
  }

  private async removeQuietly(key: string) {
    try {
      await this.storage.remove('public', key);
    } catch (err) {
      this.logger.warn(`could not remove old photo ${key}: ${(err as Error).message}`);
    }
  }

  /** Active terms whose key or label matches free text from the old fields, case-insensitively. */
  private async matchingTerms(byKind: Partial<Record<'SPECIALTY' | 'MODALITY' | 'LANGUAGE', string[]>>) {
    const wanted = Object.entries(byKind).flatMap(([kind, values]) =>
      (values ?? []).map((v) => ({ kind, text: v.trim().toLowerCase() })).filter((w) => w.text),
    );
    if (!wanted.length) return [];
    const terms = await this.prisma.taxonomyTerm.findMany({
      where: { isActive: true, kind: { in: [...new Set(wanted.map((w) => w.kind))] as never } },
      select: { id: true, kind: true, key: true, label: true },
    });
    const ids = new Set<bigint>();
    for (const w of wanted) {
      const match = terms.find(
        (t) => t.kind === w.kind && (t.key === w.text || t.label.toLowerCase() === w.text || t.key === w.text.replace(/\s+/g, '-')),
      );
      if (match) ids.add(match.id);
    }
    return [...ids];
  }
}
