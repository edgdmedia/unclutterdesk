import type { PractitionerKind, SectionKey, TaxonomyKind } from '../practice/profile/profileApi';

/** Shared shapes and labels for the platform-admin profile content screens. */

export type { PractitionerKind, SectionKey, TaxonomyKind };

export const PROFILE_CONTENT_BASE = '/v1/admin/practitioner-profile';

export const SECTION_ORDER: readonly SectionKey[] = [
  'identity',
  'about',
  'qualifications',
  'specialties',
  'approach',
  'population',
  'languages',
  'experience',
  'fees',
  'contact',
];

export const TAXONOMY_KINDS: readonly TaxonomyKind[] = ['SPECIALTY', 'MODALITY', 'POPULATION', 'LANGUAGE'];

export const TAXONOMY_KIND_LABELS: Record<TaxonomyKind, string> = {
  SPECIALTY: 'Specialties',
  MODALITY: 'Modalities',
  POPULATION: 'Populations',
  LANGUAGE: 'Languages',
};

export const TAXONOMY_KIND_SINGULAR: Record<TaxonomyKind, string> = {
  SPECIALTY: 'specialty',
  MODALITY: 'modality',
  POPULATION: 'population',
  LANGUAGE: 'language',
};

export const KIND_OPTIONS: { value: PractitionerKind; label: string }[] = [
  { value: 'COUNSELLOR', label: 'Counsellor' },
  { value: 'PSYCHOTHERAPIST', label: 'Psychotherapist' },
  { value: 'PSYCHOLOGIST', label: 'Psychologist' },
  { value: 'PSYCHIATRIST', label: 'Psychiatrist' },
  { value: 'SOCIAL_WORKER', label: 'Social worker' },
  { value: 'TRAINEE', label: 'Trainee counsellor' },
];

export type AdminGuidance = Partial<Record<SectionKey, string>>;

export interface AdminTemplateSection {
  prompt?: string;
  example?: string | null;
}

export interface AdminTemplateSections {
  guidance?: AdminGuidance;
  sections?: Partial<Record<SectionKey, AdminTemplateSection>>;
  suggested?: Partial<Record<TaxonomyKind, string[]>>;
}

export interface AdminProfileTemplate {
  key: string;
  title: string;
  description: string;
  kind: PractitionerKind | null;
  isActive: boolean;
  sortOrder: number;
  sections: AdminTemplateSections;
  updatedAt: string;
}

export interface AdminTaxonomyTerm {
  id: string;
  kind: TaxonomyKind;
  key: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
}

export interface TemplateSectionDraft {
  prompt: string;
  example: string;
}

export type TemplateSectionDrafts = Record<SectionKey, TemplateSectionDraft>;

export function blankTemplateSections(): TemplateSectionDrafts {
  return Object.fromEntries(SECTION_ORDER.map((section) => [section, { prompt: '', example: '' }])) as TemplateSectionDrafts;
}

export function draftSections(template: AdminProfileTemplate | null | undefined): TemplateSectionDrafts {
  const out = blankTemplateSections();
  for (const section of SECTION_ORDER) {
    const stored = template?.sections?.sections?.[section];
    out[section] = { prompt: stored?.prompt ?? '', example: stored?.example ?? '' };
  }
  return out;
}