import { BadRequestException } from '@nestjs/common';
import { PractitionerKind } from '@prisma/client';
import { SECTION_ORDER, type SectionKey } from './completeness';

/**
 * Validation for the platform-admin profile content screens (spec §6.6):
 * templates (title, description, prompts and examples) and the shared
 * per-section guidance. Content is edited in one place and read by every
 * practitioner's editor, so bad input is rejected before it reaches the DB.
 */

export const PROFILE_CONTENT_LIMITS = {
  title: 120,
  description: 500,
  prompt: 300,
  example: 2000,
  guidance: 600,
  reason: 500,
  sortOrder: 10000,
} as const;

const SECTION_KEYS = new Set<string>(SECTION_ORDER);
const KINDS = new Set<string>(Object.values(PractitionerKind));

export interface TemplateSectionInput {
  prompt: string;
  /** `null` clears an example; omitted preserves the stored one. */
  example?: string | null;
}

export type TemplateSectionsInput = Partial<Record<SectionKey, TemplateSectionInput>>;

export interface TemplateUpdateInput {
  title?: string;
  description?: string;
  kind?: PractitionerKind | null;
  isActive?: boolean;
  sortOrder?: number;
  sections?: TemplateSectionsInput;
  reason?: string | null;
}

export interface GuidanceUpdateInput {
  guidance: Partial<Record<SectionKey, string>>;
  reason?: string | null;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, max: number, required: boolean): string | null {
  if (value === null || value === undefined) {
    if (required) throw new BadRequestException(`${field} is required`);
    return null;
  }
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be text`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new BadRequestException(`${field} is required`);
  if (trimmed.length > max) throw new BadRequestException(`${field} can be at most ${max} characters`);
  return trimmed || null;
}

function knownKeys(value: Record<string, unknown>, allowed: readonly string[], field: string) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new BadRequestException(`${field} has an unknown field: ${key}`);
  }
}

/** Prompts and examples, keyed by profile section. */
export function parseTemplateSections(value: unknown): TemplateSectionsInput {
  const input = record(value, 'sections');
  const out: TemplateSectionsInput = {};

  for (const [section, raw] of Object.entries(input)) {
    if (!SECTION_KEYS.has(section)) throw new BadRequestException(`Unknown profile section: ${section}`);
    const entry = record(raw, `sections.${section}`);
    knownKeys(entry, ['prompt', 'example'], `sections.${section}`);

    const prompt = text(entry.prompt, `sections.${section}.prompt`, PROFILE_CONTENT_LIMITS.prompt, true);
    const sectionOut: TemplateSectionInput = { prompt: prompt as string };
    if ('example' in entry) {
      sectionOut.example = entry.example === null ? null : text(entry.example, `sections.${section}.example`, PROFILE_CONTENT_LIMITS.example, false);
    }
    out[section as SectionKey] = sectionOut;
  }

  return out;
}

/** Shared guidance, keyed by profile section. A partial edit is merged by the service. */
export function parseGuidance(value: unknown): Partial<Record<SectionKey, string>> {
  const input = record(value, 'guidance');
  const out: Partial<Record<SectionKey, string>> = {};

  for (const [section, raw] of Object.entries(input)) {
    if (!SECTION_KEYS.has(section)) throw new BadRequestException(`Unknown profile section: ${section}`);
    const line = text(raw, `guidance.${section}`, PROFILE_CONTENT_LIMITS.guidance, true);
    out[section as SectionKey] = line as string;
  }

  if (Object.keys(out).length === 0) throw new BadRequestException('Add guidance for at least one section');
  return out;
}

export function parseTemplateUpdate(value: unknown): TemplateUpdateInput {
  const input = record(value, 'body');
  knownKeys(input, ['title', 'description', 'kind', 'isActive', 'sortOrder', 'sections', 'reason'], 'body');

  const out: TemplateUpdateInput = {};
  let touched = false;

  if ('title' in input) {
    out.title = text(input.title, 'title', PROFILE_CONTENT_LIMITS.title, true) as string;
    touched = true;
  }
  if ('description' in input) {
    out.description = text(input.description, 'description', PROFILE_CONTENT_LIMITS.description, true) as string;
    touched = true;
  }
  if ('kind' in input) {
    if (input.kind !== null && (typeof input.kind !== 'string' || !KINDS.has(input.kind))) {
      throw new BadRequestException('kind must be a known practitioner kind or null');
    }
    out.kind = input.kind as PractitionerKind | null;
    touched = true;
  }
  if ('isActive' in input) {
    if (typeof input.isActive !== 'boolean') throw new BadRequestException('isActive must be true or false');
    out.isActive = input.isActive;
    touched = true;
  }
  if ('sortOrder' in input) {
    if (!Number.isInteger(input.sortOrder) || Math.abs(input.sortOrder as number) > PROFILE_CONTENT_LIMITS.sortOrder) {
      throw new BadRequestException(`sortOrder must be a whole number from -${PROFILE_CONTENT_LIMITS.sortOrder} to ${PROFILE_CONTENT_LIMITS.sortOrder}`);
    }
    out.sortOrder = input.sortOrder as number;
    touched = true;
  }
  if ('sections' in input) {
    out.sections = parseTemplateSections(input.sections);
    touched = true;
  }
  if ('reason' in input) out.reason = text(input.reason, 'reason', PROFILE_CONTENT_LIMITS.reason, false);

  if (!touched) throw new BadRequestException('Nothing to update');
  return out;
}

export function parseGuidanceUpdate(value: unknown): GuidanceUpdateInput {
  const input = record(value, 'body');
  knownKeys(input, ['guidance', 'reason'], 'body');
  if (!('guidance' in input)) throw new BadRequestException('guidance is required');

  const out: GuidanceUpdateInput = { guidance: parseGuidance(input.guidance) };
  if ('reason' in input) out.reason = text(input.reason, 'reason', PROFILE_CONTENT_LIMITS.reason, false);
  return out;
}