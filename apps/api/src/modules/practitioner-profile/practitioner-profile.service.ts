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
import { isLayoutKey, isThemeKey } from './themes';
import { writingTips } from './writing-tips';
import { HANDLE_MESSAGES, handleProblem, normalizeHandle, suggestHandle } from './handles';
import { PHOTO_BACKFILL_JOB, type PhotoBackfillPayload } from './profile-photo.job';
import { SITEMAP_TAG, profileTag, queuePurge } from './profile-purge.job';

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

export const PRACTITIONER_KINDS: readonly PractitionerKind[] = [
  'COUNSELLOR',
  'PSYCHOTHERAPIST',
  'PSYCHOLOGIST',
  'PSYCHIATRIST',
  'SOCIAL_WORKER',
  'TRAINEE',
];

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

const SOCIAL_KEYS = ['website', 'instagram', 'linkedin', 'facebook', 'x', 'tiktok', 'youtube'] as const;

/** Fields a therapist edits with PATCH /v1/profile/me. Handle, status and booking mode have their own flows. */
export type ProfileUpdateInput = Partial<Record<TextField, string | null>> &
  Partial<Record<BooleanField, boolean>> & {
    kind?: PractitionerKind;
    countryCode?: string;
    selfReportedYears?: number | null;
    contactEmailPublic?: string | null;
    socialLinks?: Partial<Record<(typeof SOCIAL_KEYS)[number], string>> | null;
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
    return this.prisma.practitionerProfile.findUnique({ where: { userId }, include: OWN_PROFILE_INCLUDE });
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
    await this.syncPracticeRecords(userId);
    await this.purgeIfPublished(userId);
    return this.getOwn(userId);
  }

  /** Change the signed-in user's own profile fields. */
  async updateOwn(userId: bigint, input: ProfileUpdateInput & ProfileAppearanceInput) {
    const data: Prisma.PractitionerProfileUpdateInput = {};

    if ('themeKey' in input) {
      if (!isThemeKey(input.themeKey)) throw new BadRequestException('Unknown theme');
      data.themeKey = input.themeKey;
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
      const links = input.socialLinks;
      if (links === null) {
        data.socialLinks = Prisma.DbNull;
      } else if (typeof links !== 'object' || Array.isArray(links)) {
        throw new BadRequestException('socialLinks must be a set of links');
      } else {
        const clean: Record<string, string> = {};
        for (const [key, value] of Object.entries(links)) {
          if (!(SOCIAL_KEYS as readonly string[]).includes(key)) throw new BadRequestException(`Unknown link: ${key}`);
          if (value) clean[key] = httpsUrl(value, key);
        }
        data.socialLinks = clean;
      }
    }

    await this.requireOwn(userId);
    await this.prisma.practitionerProfile.update({ where: { userId }, data });
    await this.refreshOwnScore(userId);
    await this.syncPracticeRecords(userId);
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
    await this.syncPracticeRecords(userId);
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
    await this.syncPracticeRecords(userId);
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
    await this.syncPracticeRecords(userId);
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
    await this.syncPracticeRecords(userId);
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

  /**
   * Copy what the public profile now owns back to the deprecated fields on
   * every practice record of this person (ConsultTherapistProfile), which the
   * practice booking page still reads. The profile is the one place these are
   * edited; this keeps the booking page in step until it reads the profile
   * itself. Practice-only settings (emails, video, locations, welcome
   * message, online/in-person per practice) are never touched.
   */
  private async syncPracticeRecords(userId: bigint) {
    const profile = await this.prisma.practitionerProfile.findUnique({
      where: { userId },
      select: {
        headline: true,
        credentialsText: true,
        selfReportedYears: true,
        taxonomy: { select: { isPrimary: true, term: { select: { kind: true, label: true, sortOrder: true } } } },
      },
    });
    if (!profile) return;
    const labels = (kind: string, primaryOnly = false) =>
      profile.taxonomy
        .filter((t) => t.term.kind === kind && (!primaryOnly || t.isPrimary))
        .sort((a, b) => a.term.sortOrder - b.term.sortOrder)
        .map((t) => t.term.label);
    const specialties = labels('SPECIALTY', true).length ? labels('SPECIALTY', true) : labels('SPECIALTY');
    await this.prisma.consultTherapistProfile.updateMany({
      where: { profile: { userId } },
      data: {
        tagline: profile.headline,
        credentials: profile.credentialsText,
        yearsExperience: profile.selfReportedYears,
        specialty: specialties.join(', ') || null,
        modalities: labels('MODALITY'),
        languages: labels('LANGUAGE'),
      },
    });
  }

  /** After a change to a published profile, purge its page (§6.12). Drafts and hidden profiles aren't served, so there is nothing to purge. */
  private async purgeIfPublished(userId: bigint) {
    const profile = await this.prisma.practitionerProfile.findUnique({ where: { userId }, select: { handle: true, status: true } });
    if (profile?.status === 'PUBLISHED') await this.purge([profileTag(profile.handle)]);
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
    const links = profile.socialLinks && typeof profile.socialLinks === 'object' ? Object.keys(profile.socialLinks as object) : [];
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
