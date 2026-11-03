import { BadRequestException } from '@nestjs/common';
import { TaxonomyKind } from '@prisma/client';

/**
 * Validation for the platform-admin taxonomy screen (spec §6.4/§6.6):
 * specialties, modalities, populations and languages. Keys are stable slugs
 * used by templates and profile data; labels are what practitioners and
 * clients see. Deactivation is preferred to deletion, because profiles keep
 * their history and public pages only show active terms.
 */

export const TAXONOMY_LIMITS = {
  label: 80,
  key: 60,
  reason: 500,
  sortOrder: 10000,
  reorder: 500,
} as const;

const KINDS = new Set<string>(Object.values(TaxonomyKind));
const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface CreateTaxonomyInput {
  kind: TaxonomyKind;
  label: string;
  key?: string;
  sortOrder?: number;
  reason?: string | null;
}

export interface UpdateTaxonomyInput {
  label?: string;
  key?: string;
  isActive?: boolean;
  sortOrder?: number;
  reason?: string | null;
}

export interface ReorderTaxonomyInput {
  kind: TaxonomyKind;
  ids: bigint[];
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

function kind(value: unknown): TaxonomyKind {
  if (typeof value !== 'string' || !KINDS.has(value)) {
    throw new BadRequestException(`kind must be one of: ${[...KINDS].join(', ')}`);
  }
  return value as TaxonomyKind;
}

function sortOrder(value: unknown): number {
  if (!Number.isInteger(value) || Math.abs(value as number) > TAXONOMY_LIMITS.sortOrder) {
    throw new BadRequestException(`sortOrder must be a whole number from -${TAXONOMY_LIMITS.sortOrder} to ${TAXONOMY_LIMITS.sortOrder}`);
  }
  return value as number;
}

/** A stable slug for a term. Admin can override it; the service enforces uniqueness within the kind. */
export function taxonomyKey(value: unknown): string {
  const raw = text(value, 'key', TAXONOMY_LIMITS.key, true) as string;
  const key = raw.toLowerCase();
  if (!KEY.test(key)) throw new BadRequestException('key must use lowercase letters, numbers and single hyphens');
  return key;
}

export function taxonomyKeyFromLabel(label: string): string {
  const raw = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return raw.slice(0, TAXONOMY_LIMITS.key).replace(/-+$/g, '');
}

export function parseTaxonomyCreate(value: unknown): CreateTaxonomyInput {
  const input = record(value, 'body');
  knownKeys(input, ['kind', 'label', 'key', 'sortOrder', 'reason'], 'body');

  const label = text(input.label, 'label', TAXONOMY_LIMITS.label, true) as string;
  const out: CreateTaxonomyInput = { kind: kind(input.kind), label };
  if ('key' in input) out.key = taxonomyKey(input.key);
  if ('sortOrder' in input) out.sortOrder = sortOrder(input.sortOrder);
  if ('reason' in input) out.reason = text(input.reason, 'reason', TAXONOMY_LIMITS.reason, false);
  return out;
}

export function parseTaxonomyUpdate(value: unknown): UpdateTaxonomyInput {
  const input = record(value, 'body');
  knownKeys(input, ['label', 'key', 'isActive', 'sortOrder', 'reason'], 'body');

  const out: UpdateTaxonomyInput = {};
  let touched = false;
  if ('label' in input) {
    out.label = text(input.label, 'label', TAXONOMY_LIMITS.label, true) as string;
    touched = true;
  }
  if ('key' in input) {
    out.key = taxonomyKey(input.key);
    touched = true;
  }
  if ('isActive' in input) {
    if (typeof input.isActive !== 'boolean') throw new BadRequestException('isActive must be true or false');
    out.isActive = input.isActive;
    touched = true;
  }
  if ('sortOrder' in input) {
    out.sortOrder = sortOrder(input.sortOrder);
    touched = true;
  }
  if ('reason' in input) out.reason = text(input.reason, 'reason', TAXONOMY_LIMITS.reason, false);
  if (!touched) throw new BadRequestException('Nothing to update');
  return out;
}

function ids(value: unknown): bigint[] {
  if (!Array.isArray(value) || value.length === 0) throw new BadRequestException('ids must be a non-empty list');
  if (value.length > TAXONOMY_LIMITS.reorder) {
    throw new BadRequestException(`Reorder at most ${TAXONOMY_LIMITS.reorder} terms at once`);
  }

  const out: bigint[] = [];
  for (const raw of value) {
    const textValue = typeof raw === 'bigint' ? raw.toString() : typeof raw === 'string' ? raw : String(raw ?? '');
    if (!/^\d+$/.test(textValue)) throw new BadRequestException('Each id must be a term id');
    out.push(BigInt(textValue));
  }
  if (new Set(out.map(String)).size !== out.length) throw new BadRequestException('A term is listed twice');
  return out;
}

export function parseTaxonomyReorder(value: unknown): ReorderTaxonomyInput {
  const input = record(value, 'body');
  knownKeys(input, ['kind', 'ids', 'reason'], 'body');
  const out: ReorderTaxonomyInput = { kind: kind(input.kind), ids: ids(input.ids) };
  if ('reason' in input) out.reason = text(input.reason, 'reason', TAXONOMY_LIMITS.reason, false);
  return out;
}