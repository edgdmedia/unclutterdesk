import { api } from '../../../utils/apiClient';

/** The signed-in practitioner's public profile (API: /v1/practitioner-profile). */

export type PractitionerKind = 'COUNSELLOR' | 'PSYCHOTHERAPIST' | 'PSYCHOLOGIST' | 'PSYCHIATRIST' | 'SOCIAL_WORKER' | 'TRAINEE';
export type ProfileStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'SUSPENDED';
export type TaxonomyKind = 'SPECIALTY' | 'MODALITY' | 'POPULATION' | 'LANGUAGE';
export type SectionKey =
  | 'identity'
  | 'about'
  | 'qualifications'
  | 'specialties'
  | 'approach'
  | 'population'
  | 'languages'
  | 'experience'
  | 'fees'
  | 'contact';

export const KIND_LABELS: Record<PractitionerKind, string> = {
  COUNSELLOR: 'Counsellor',
  PSYCHOTHERAPIST: 'Psychotherapist',
  PSYCHOLOGIST: 'Psychologist',
  PSYCHIATRIST: 'Psychiatrist',
  SOCIAL_WORKER: 'Social worker',
  TRAINEE: 'Trainee counsellor',
};

export const SECTION_TITLES: Record<SectionKey, string> = {
  identity: 'Identity',
  about: 'About',
  qualifications: 'Qualifications & training',
  specialties: 'Specialties',
  approach: 'Approach & modalities',
  population: 'Who I work with',
  languages: 'Languages',
  experience: 'Experience',
  fees: 'Sessions & fees',
  contact: 'Book / contact',
};

export interface TaxonomyTerm {
  id: string;
  kind: TaxonomyKind;
  key: string;
  label: string;
}

export interface TimelineEntry {
  type: 'EDUCATION' | 'TRAINING' | 'PRACTICE' | 'SUPERVISION' | 'MEMBERSHIP' | 'MILESTONE';
  title: string;
  organisation?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  description?: string | null;
}

export interface OwnProfile {
  id: string;
  handle: string;
  status: ProfileStatus;
  kind: PractitionerKind;
  templateKey: string | null;
  themeKey: string;
  displayName: string;
  pronouns: string | null;
  photoKey: string | null;
  headline: string | null;
  about: string | null;
  approach: string | null;
  credentialsText: string | null;
  city: string | null;
  countryCode: string;
  offersOnline: boolean;
  offersInPerson: boolean;
  acceptingClients: boolean;
  faithIntegration: string | null;
  supervisedBy: string | null;
  showPlatformExperience: boolean;
  selfReportedYears: number | null;
  feeRangeText: string | null;
  contactEmailPublic: string | null;
  socialLinks: Record<string, string> | null;
  completenessScore: number;
  publishedAt: string | null;
  taxonomy: { termId: string; isPrimary: boolean; term: TaxonomyTerm }[];
  timeline: (TimelineEntry & { id: string })[];
}

export interface TemplateSection {
  prompt?: string;
  example?: string;
}

export interface ProfileTemplate {
  key: string;
  title: string;
  description: string;
  kind: PractitionerKind | null;
  sections: {
    guidance: Partial<Record<SectionKey, string>>;
    sections: Partial<Record<SectionKey, TemplateSection>>;
    suggested: Partial<Record<TaxonomyKind, string[]>>;
  };
}

export interface Checklist {
  score: number;
  sections: { key: SectionKey; score: number; weight: number }[];
  next: SectionKey | null;
  canPublish: boolean;
  blockers: { key: string; message: string }[];
  tips: { field: string; kind: string; severity: 'suggestion' | 'strong'; match: string; message: string }[];
  unchangedTemplateText: SectionKey[];
}

const BASE = '/v1/practitioner-profile';

export const profileApi = {
  getOwn: () => api.get<OwnProfile | null>(`${BASE}/me`),
  create: (body: { handle?: string; kind?: PractitionerKind; displayName?: string }) => api.post<OwnProfile>(BASE, body),
  update: (body: Record<string, unknown>) => api.patch<OwnProfile>(`${BASE}/me`, body),
  setTaxonomy: (terms: { termId: string; isPrimary?: boolean }[]) => api.put<OwnProfile>(`${BASE}/me/taxonomy`, { terms }),
  setTimeline: (entries: TimelineEntry[]) => api.put<OwnProfile>(`${BASE}/me/timeline`, { entries }),
  setPhoto: (image: string) => api.put<OwnProfile>(`${BASE}/me/photo`, { image }),
  removePhoto: () => api.delete<OwnProfile>(`${BASE}/me/photo`),
  changeHandle: (handle: string) => api.put<OwnProfile>(`${BASE}/me/handle`, { handle }),
  checkHandle: (handle: string) =>
    api.get<{ handle: string; available: boolean; reason?: string; message?: string }>(
      `${BASE}/handle-check/${encodeURIComponent(handle)}`,
    ),
  checklist: () => api.get<Checklist>(`${BASE}/me/checklist`),
  publish: () => api.post<{ profile: OwnProfile; warnings: { unchangedTemplateText: SectionKey[] } }>(`${BASE}/me/publish`, {}),
  unpublish: () => api.post<OwnProfile>(`${BASE}/me/unpublish`, {}),
  templates: () => api.get<ProfileTemplate[]>(`${BASE}/templates`),
  taxonomy: () => api.get<TaxonomyTerm[]>(`${BASE}/taxonomy`),
};
