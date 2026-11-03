import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  TAXONOMY_LIMITS,
  parseTaxonomyCreate,
  parseTaxonomyReorder,
  parseTaxonomyUpdate,
  taxonomyKey,
  taxonomyKeyFromLabel,
} from './taxonomy.validation';

describe('taxonomy validation (§6.4)', () => {
  it('accepts a new term and derives nothing until the service asks', () => {
    expect(parseTaxonomyCreate({ kind: 'SPECIALTY', label: '  Grief & loss  ', key: 'Grief-Loss', sortOrder: 10 })).toEqual({
      kind: 'SPECIALTY',
      label: 'Grief & loss',
      key: 'grief-loss',
      sortOrder: 10,
    });
  });

  it('turns labels into stable keys', () => {
    expect(taxonomyKeyFromLabel('Grief & loss')).toBe('grief-loss');
    expect(taxonomyKeyFromLabel('  CBT / Trauma  ')).toBe('cbt-trauma');
    expect(taxonomyKeyFromLabel('Café')).toBe('cafe');
    expect(taxonomyKeyFromLabel('日本語')).toBe('');
  });

  it('rejects malformed keys', () => {
    for (const key of ['Grief Loss', 'grief--loss', '-grief', 'grief_', '']) {
      expect(() => taxonomyKey(key), key).toThrow(BadRequestException);
    }
  });

  it('rejects an unknown kind', () => {
    expect(() => parseTaxonomyCreate({ kind: 'TOPIC', label: 'Grief' })).toThrow(/kind must be one of/);
  });

  it('rejects empty labels and excessive lengths', () => {
    expect(() => parseTaxonomyCreate({ kind: 'SPECIALTY', label: '   ' })).toThrow(/label is required/);
    expect(() => parseTaxonomyCreate({ kind: 'SPECIALTY', label: 'x'.repeat(TAXONOMY_LIMITS.label + 1) })).toThrow(/at most/);
    expect(() => parseTaxonomyCreate({ kind: 'SPECIALTY', label: 'x', key: 'x'.repeat(TAXONOMY_LIMITS.key + 1) })).toThrow(/at most/);
  });

  it('accepts each kind of update and rejects an empty one', () => {
    expect(parseTaxonomyUpdate({ label: 'Bereavement', key: 'bereavement', isActive: false, sortOrder: 20 })).toEqual({
      label: 'Bereavement',
      key: 'bereavement',
      isActive: false,
      sortOrder: 20,
    });
    expect(() => parseTaxonomyUpdate({})).toThrow(/Nothing to update/);
    expect(() => parseTaxonomyUpdate({ isActive: 'no' })).toThrow(/true or false/);
  });

  it('rejects unknown fields so a typo cannot silently do nothing', () => {
    expect(() => parseTaxonomyCreate({ kind: 'SPECIALTY', label: 'Grief', colour: 'red' })).toThrow(/unknown field/);
    expect(() => parseTaxonomyUpdate({ title: 'Grief' })).toThrow(/unknown field/);
  });

  it('accepts a reorder of one kind', () => {
    expect(parseTaxonomyReorder({ kind: 'MODALITY', ids: ['3', 7n, '9'], reason: 'grouping' })).toEqual({
      kind: 'MODALITY',
      ids: [3n, 7n, 9n],
      reason: 'grouping',
    });
  });

  it('rejects reorders with duplicate, malformed or excessive ids', () => {
    expect(() => parseTaxonomyReorder({ kind: 'MODALITY', ids: ['3', '3'] })).toThrow(/listed twice/);
    expect(() => parseTaxonomyReorder({ kind: 'MODALITY', ids: ['three'] })).toThrow(/term id/);
    expect(() => parseTaxonomyReorder({ kind: 'MODALITY', ids: [] })).toThrow(/non-empty/);
    expect(() => parseTaxonomyReorder({ kind: 'MODALITY', ids: ['1'], extra: true })).toThrow(/unknown field/);
    expect(() =>
      parseTaxonomyReorder({ kind: 'MODALITY', ids: Array.from({ length: TAXONOMY_LIMITS.reorder + 1 }, (_, i) => String(i + 1)) }),
    ).toThrow(/at most/);
  });
});