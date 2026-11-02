import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type PractitionerKind } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { HANDLE_MESSAGES, handleProblem, normalizeHandle, suggestHandle } from './handles';
import { PHOTO_BACKFILL_JOB, type PhotoBackfillPayload } from './profile-photo.job';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
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
    return created;
  }

  /** Change the signed-in user's own profile fields. */
  async updateOwn(userId: bigint, input: ProfileUpdateInput) {
    const data: Prisma.PractitionerProfileUpdateInput = {};

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
    return this.prisma.practitionerProfile.update({ where: { userId }, data, include: OWN_PROFILE_INCLUDE });
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
    return this.getOwn(userId);
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
