import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

/** What clients see about a therapist, wherever they see it (§6.17). */
export interface PersonFacts {
  displayName: string | null;
  photoUrl: string | null;
  headline: string | null;
  about: string | null;
  credentials: string | null;
  yearsExperience: number | null;
  specialties: string[];
  modalities: string[];
  languages: string[];
  offersOnline: boolean | null;
  offersInPerson: boolean | null;
  city: string | null;
}

/** The older copies on the practice record, read only for someone with no profile yet. */
export interface LegacyFacts {
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  tagline: string | null;
  welcomeMessage: string | null;
  credentials: string | null;
  yearsExperience: number | null;
  specialty: string | null;
  modalities: string[];
  languages: string[];
  offersOnline: boolean;
  offersInPerson: boolean;
}

/**
 * §6.17: the one reader for facts about a therapist. They live on the
 * person's profile (PractitionerProfile), whether it's published or not; the
 * booking page and practice screens read them from here and never from the
 * practice record. The practice record is used only for someone who has no
 * profile yet (the back-fill job gives everyone one).
 */
@Injectable()
export class PersonFactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async forUsers(userIds: bigint[]): Promise<Map<string, PersonFacts>> {
    const out = new Map<string, PersonFacts>();
    if (!userIds.length) return out;
    const profiles = await this.prisma.practitionerProfile.findMany({
      where: { userId: { in: [...new Set(userIds)] } },
      select: {
        userId: true,
        displayName: true,
        photoKey: true,
        headline: true,
        about: true,
        credentialsText: true,
        selfReportedYears: true,
        offersOnline: true,
        offersInPerson: true,
        city: true,
        taxonomy: { select: { isPrimary: true, term: { select: { kind: true, label: true, sortOrder: true, isActive: true } } } },
      },
    });
    const publicUrl = (key: string | null) => (key && this.storage.configured('public') ? this.storage.publicUrl(key) : null);
    for (const p of profiles) {
      const labels = (kind: string) =>
        p.taxonomy
          .filter((t) => t.term.kind === kind && t.term.isActive)
          .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.term.sortOrder - b.term.sortOrder)
          .map((t) => t.term.label);
      out.set(p.userId.toString(), {
        displayName: p.displayName,
        photoUrl: publicUrl(p.photoKey),
        headline: p.headline,
        about: p.about,
        credentials: p.credentialsText,
        yearsExperience: p.selfReportedYears,
        specialties: labels('SPECIALTY'),
        modalities: labels('MODALITY'),
        languages: labels('LANGUAGE'),
        offersOnline: p.offersOnline,
        offersInPerson: p.offersInPerson,
        city: p.city,
      });
    }
    return out;
  }

  /** The facts for one person: from their profile, or from the practice record if they have none yet. */
  static resolve(facts: PersonFacts | undefined, legacy: LegacyFacts): PersonFacts {
    if (facts) return { ...facts, photoUrl: facts.photoUrl ?? legacy.avatarUrl };
    return {
      displayName: [legacy.firstName, legacy.lastName].filter(Boolean).join(' ').trim() || null,
      photoUrl: legacy.avatarUrl,
      headline: legacy.tagline,
      about: legacy.welcomeMessage,
      credentials: legacy.credentials,
      yearsExperience: legacy.yearsExperience,
      specialties: legacy.specialty ? legacy.specialty.split(/\s*[,;/]\s*/).filter(Boolean) : [],
      modalities: legacy.modalities,
      languages: legacy.languages,
      offersOnline: legacy.offersOnline,
      offersInPerson: legacy.offersInPerson,
      city: null,
    };
  }
}
