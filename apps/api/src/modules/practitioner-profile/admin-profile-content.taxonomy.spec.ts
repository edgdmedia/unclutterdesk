import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AdminProfileContentService } from './admin-profile-content.service';

interface Term {
  id: bigint;
  kind: string;
  key: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  _count?: { profiles: number };
}

function terms(): Term[] {
  return [
    { id: 1n, kind: 'SPECIALTY', key: 'anxiety', label: 'Anxiety', isActive: true, sortOrder: 10, _count: { profiles: 2 } },
    { id: 2n, kind: 'SPECIALTY', key: 'grief', label: 'Grief', isActive: true, sortOrder: 20, _count: { profiles: 0 } },
    { id: 3n, kind: 'MODALITY', key: 'cbt', label: 'CBT', isActive: true, sortOrder: 10, _count: { profiles: 1 } },
  ];
}

function setup(profiles: { handle: string }[] = [{ handle: 'adaeze' }, { handle: 'adaeze' }, { handle: 'bola' }]) {
  const rows = terms();
  const prisma: any = {
    taxonomyTerm: {
      findMany: vi.fn(async ({ where }: any = {}) => {
        let out = rows;
        if (where?.id?.in) out = out.filter((row) => where.id.in.includes(row.id));
        if (where?.kind) out = out.filter((row) => row.kind === where.kind);
        return out;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.kind_key) {
          return rows.find((row) => row.kind === where.kind_key.kind && row.key === where.kind_key.key) ?? null;
        }
        return rows.find((row) => row.id === where.id) ?? null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const row: Term = { id: BigInt(rows.length + 1), ...data, isActive: true, _count: { profiles: 0 } };
        rows.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = rows.find((candidate) => candidate.id === where.id);
        if (!row) throw new Error('missing row');
        Object.assign(row, data);
        return row;
      }),
    },
    practitionerProfile: { findMany: vi.fn(async () => profiles) },
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  const audit: any = { record: vi.fn(async (entry: unknown) => entry) };
  const jobs: any = { enqueue: vi.fn(async () => ({ id: 9n })), runNow: vi.fn(async () => undefined) };
  return { service: new AdminProfileContentService(prisma, audit, jobs), prisma, audit, jobs, rows };
}

describe('AdminProfileContentService taxonomy (§6.4)', () => {
  it('lists every term with a string id and its usage count', async () => {
    const { service } = setup();
    await expect(service.listTaxonomy()).resolves.toEqual([
      { id: '1', kind: 'SPECIALTY', key: 'anxiety', label: 'Anxiety', isActive: true, sortOrder: 10, usageCount: 2 },
      { id: '2', kind: 'SPECIALTY', key: 'grief', label: 'Grief', isActive: true, sortOrder: 20, usageCount: 0 },
      { id: '3', kind: 'MODALITY', key: 'cbt', label: 'CBT', isActive: true, sortOrder: 10, usageCount: 1 },
    ]);
  });

  it('creates a term with a derived key and audits it', async () => {
    const { service, prisma, audit } = setup();
    const created = await service.createTaxonomy(3n, {
      kind: 'SPECIALTY',
      label: 'Panic & anxiety',
      reason: 'requested by practitioners',
    });

    expect(created).toMatchObject({ kind: 'SPECIALTY', key: 'panic-anxiety', label: 'Panic & anxiety', isActive: true });
    expect(prisma.taxonomyTerm.create).toHaveBeenCalledWith({
      data: { kind: 'SPECIALTY', key: 'panic-anxiety', label: 'Panic & anxiety', sortOrder: 0 },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 3n,
        action: 'profile.taxonomy.create',
        targetType: 'TaxonomyTerm',
        reason: 'requested by practitioners',
      }),
    );
  });

  it('refuses a duplicate key within the same kind', async () => {
    const { service } = setup();
    await expect(service.createTaxonomy(3n, { kind: 'SPECIALTY', label: 'Anxiety' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses a label that cannot make a key', async () => {
    const { service } = setup();
    await expect(service.createTaxonomy(3n, { kind: 'SPECIALTY', label: '日本語' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('renames a term, audits it and purges the profiles that show it', async () => {
    const { service, audit, jobs } = setup();
    const updated = await service.updateTaxonomy(3n, '2', { label: 'Bereavement & loss', reason: 'plain words' });

    expect(updated).toMatchObject({ id: '2', label: 'Bereavement & loss' });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'profile.taxonomy.update', targetType: 'TaxonomyTerm', targetId: 2n }),
    );
    expect(jobs.enqueue).toHaveBeenCalledWith('profile.purge', { tags: ['profile:adaeze', 'profile:bola'] });
    expect(jobs.runNow).toHaveBeenCalledWith(9n);
  });

  it('deactivates without deleting, and purges the public pages', async () => {
    const { service, rows, jobs } = setup();
    const updated = await service.updateTaxonomy(3n, '1', { isActive: false });

    expect(updated.isActive).toBe(false);
    expect(rows.find((row) => row.id === 1n)).toBeDefined();
    expect(jobs.enqueue).toHaveBeenCalledOnce();
  });

  it('does not enqueue a purge when no published profile uses the term', async () => {
    const { service, jobs } = setup([]);
    await service.updateTaxonomy(3n, '2', { label: 'Bereavement' });
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it('refuses a re-key that another term already holds', async () => {
    const { service } = setup();
    await expect(service.updateTaxonomy(3n, '2', { key: 'anxiety' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('answers 404 for an unknown term and rejects a malformed id', async () => {
    const { service } = setup();
    await expect(service.updateTaxonomy(3n, '99', { label: 'Nope' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.updateTaxonomy(3n, 'two', { label: 'Nope' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies a reorder to one kind, audits it and purges those profiles', async () => {
    const { service, prisma, audit, jobs } = setup();
    const result = await service.reorderTaxonomy(3n, { kind: 'SPECIALTY', ids: ['2', '1'], reason: 'most used first' });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    const updates = prisma.taxonomyTerm.update.mock.calls.map((call: any[]) => call[0]);
    expect(updates).toEqual([
      { where: { id: 2n }, data: { sortOrder: 0 } },
      { where: { id: 1n }, data: { sortOrder: 10 } },
    ]);
    expect(result.map((term) => term.id)).toEqual(['1', '2', '3']);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'profile.taxonomy.reorder', targetType: 'TaxonomyKind', targetId: 'SPECIALTY' }),
    );
    expect(jobs.enqueue).toHaveBeenCalledWith('profile.purge', { tags: ['profile:adaeze', 'profile:bola'] });
  });

  it('refuses to reorder a term from another kind', async () => {
    const { service } = setup();
    await expect(service.reorderTaxonomy(3n, { kind: 'SPECIALTY', ids: ['1', '3'] })).rejects.toBeInstanceOf(BadRequestException);
  });
});