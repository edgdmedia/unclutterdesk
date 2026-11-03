import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type TaxonomyKind } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JobsService } from '../jobs/jobs.service';
import { SECTION_ORDER, type SectionKey } from './completeness';
import { PURGE_JOB, profileTag, type PurgePayload } from './profile-purge.job';
import {
  parseGuidanceUpdate,
  parseTemplateUpdate,
  type TemplateSectionsInput,
  type TemplateUpdateInput,
} from './profile-content.validation';
import {
  parseTaxonomyCreate,
  parseTaxonomyReorder,
  parseTaxonomyUpdate,
  taxonomyKeyFromLabel,
  type CreateTaxonomyInput,
  type ReorderTaxonomyInput,
  type UpdateTaxonomyInput,
} from './taxonomy.validation';

/**
 * Platform-admin editing of the profile templates, shared guidance and
 * taxonomy (spec §6.4, §6.6). The seed migration inserts the starter content;
 * after that the database is the source of truth and every edit is written to
 * the admin audit log. Nothing here is tenant-scoped: all three are global.
 */

export const GENERAL_PROFILE_TEMPLATE_KEY = 'general';

type StoredRecord = Record<string, unknown>;

function storedRecord(value: unknown): StoredRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as StoredRecord) } : {};
}

function objectAt(record: StoredRecord, key: string): StoredRecord {
  const value = record[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as StoredRecord) } : {};
}

function guidanceFrom(sections: unknown): Partial<Record<SectionKey, string>> {
  const guidance = objectAt(storedRecord(sections), 'guidance');
  const out: Partial<Record<SectionKey, string>> = {};
  for (const section of SECTION_ORDER) {
    const line = guidance[section];
    if (typeof line === 'string' && line.trim()) out[section] = line;
  }
  return out;
}

function mergeSections(existing: unknown, patch: TemplateSectionsInput): StoredRecord {
  const stored = storedRecord(existing);
  const sections = objectAt(stored, 'sections');

  for (const [section, update] of Object.entries(patch)) {
    if (!update) {
      delete sections[section];
      continue;
    }
    const current = objectAt(sections, section);
    const next: StoredRecord = { ...current, prompt: update.prompt };
    if ('example' in update) next.example = update.example;
    sections[section] = next;
  }

  stored.sections = sections;
  return stored;
}

function withGuidance(existing: unknown, guidance: Partial<Record<SectionKey, string>>): StoredRecord {
  const stored = storedRecord(existing);
  stored.guidance = guidance;
  return stored;
}

/** Replace a term's old slug with its new one in one template's suggested lists. */
function rewriteSuggestedKey(
  existing: unknown,
  kind: TaxonomyKind,
  oldKey: string,
  newKey: string,
): { sections: StoredRecord; changed: boolean } {
  const stored = storedRecord(existing);
  const suggested = objectAt(stored, 'suggested');
  const list = suggested[kind];
  if (!Array.isArray(list) || !list.includes(oldKey)) return { sections: stored, changed: false };

  suggested[kind] = [...new Set(list.map((key) => (key === oldKey ? newKey : key)))];
  stored.suggested = suggested;
  return { sections: stored, changed: true };
}

@Injectable()
export class AdminProfileContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
  ) {}

  /** Every editable template; the internal `general` row is served by getGuidance instead. */
  async listTemplates() {
    const rows = await this.prisma.profileTemplate.findMany({
      where: { key: { not: GENERAL_PROFILE_TEMPLATE_KEY } },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
    return rows.map((row) => this.serialise(row));
  }

  /** The shared guidance that every template falls back to. */
  async getGuidance() {
    const general = await this.prisma.profileTemplate.findUnique({
      where: { key: GENERAL_PROFILE_TEMPLATE_KEY },
      select: { sections: true },
    });
    if (!general) throw new NotFoundException('General profile guidance is missing');
    return { guidance: guidanceFrom(general.sections) };
  }

  /** Edit one template. The shared general row is edited through updateGuidance. */
  async updateTemplate(actorUserId: bigint, key: string, input: unknown) {
    const update = parseTemplateUpdate(input);
    if (key === GENERAL_PROFILE_TEMPLATE_KEY) {
      throw new BadRequestException('Edit the shared guidance with the guidance endpoint');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.profileTemplate.findUnique({ where: { key } });
      if (!existing) throw new NotFoundException('Unknown template');

      // Reason required for deactivation
      if (update.isActive !== undefined && update.isActive === false && existing.isActive === true && !update.reason) {
        throw new BadRequestException('Reason is required when deactivating a template');
      }

      const data: Prisma.ProfileTemplateUpdateInput = {};
      const changed: (keyof TemplateUpdateInput)[] = [];

      if (update.title !== undefined) {
        data.title = update.title;
        changed.push('title');
      }
      if (update.description !== undefined) {
        data.description = update.description;
        changed.push('description');
      }
      if (update.kind !== undefined) {
        data.kind = update.kind;
        changed.push('kind');
      }
      if (update.isActive !== undefined) {
        data.isActive = update.isActive;
        changed.push('isActive');
      }
      if (update.sortOrder !== undefined) {
        data.sortOrder = update.sortOrder;
        changed.push('sortOrder');
      }
      if (update.sections !== undefined) {
        data.sections = mergeSections(existing.sections, update.sections) as Prisma.InputJsonValue;
        changed.push('sections');
      }

      const updated = await tx.profileTemplate.update({ where: { key }, data });

      await this.audit.record(
        {
          actorUserId,
          action: 'profile.template.update',
          targetType: 'ProfileTemplate',
          targetId: key,
          reason: update.reason ?? null,
          meta: {
            templateKey: key,
            changed: changed.map(String),
            before: this.pick(existing, changed),
            after: this.pick(updated, changed),
          } as Prisma.InputJsonValue,
        },
        tx,
      );

      return this.serialise(updated);
    });
  }

  /**
   * Edit the shared guidance. The guidance is copied onto every template row so
   * the existing editor, which reads the selected template first, sees an edit
   * immediately without a read-path change.
   */
  async updateGuidance(actorUserId: bigint, input: unknown) {
    const update = parseGuidanceUpdate(input);

    return this.prisma.$transaction(async (tx) => {
      const general = await tx.profileTemplate.findUnique({
        where: { key: GENERAL_PROFILE_TEMPLATE_KEY },
        select: { sections: true },
      });
      if (!general) throw new NotFoundException('General profile guidance is missing');

      const before = guidanceFrom(general.sections);
      const after = { ...before, ...update.guidance };
      const rows = await tx.profileTemplate.findMany({ select: { key: true, sections: true } });
      if (!rows.length) throw new NotFoundException('No profile templates exist');

      for (const row of rows) {
        await tx.profileTemplate.update({
          where: { key: row.key },
          data: { sections: withGuidance(row.sections, after) as Prisma.InputJsonValue },
        });
      }

      await this.audit.record(
        {
          actorUserId,
          action: 'profile.guidance.update',
          targetType: 'ProfileGuidance',
          targetId: GENERAL_PROFILE_TEMPLATE_KEY,
          reason: update.reason ?? null,
          meta: {
            changed: Object.keys(update.guidance),
            before,
            after,
          } as Prisma.InputJsonValue,
        },
        tx,
      );

      return { guidance: after };
    });
  }

  /** Every term, including deactivated ones, with how many profiles still use it. */
  async listTaxonomy() {
    const rows = await this.prisma.taxonomyTerm.findMany({
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
      include: { _count: { select: { profiles: true } } },
    });
    return rows.map((row) => this.serialiseTerm(row, row._count?.profiles ?? 0));
  }

  /** Add a term. Keys are stable slugs and unique within their kind. */
  async createTaxonomy(actorUserId: bigint, input: unknown) {
    const create = parseTaxonomyCreate(input);
    const key = create.key ?? taxonomyKeyFromLabel(create.label);
    if (!key) throw new BadRequestException('key is required when the label has no Latin letters');

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.taxonomyTerm.findUnique({
        where: { kind_key: { kind: create.kind, key } },
      });
      if (existing) throw new ConflictException('A term with this key already exists');

      const term = await tx.taxonomyTerm.create({
        data: { kind: create.kind, key, label: create.label, sortOrder: create.sortOrder ?? 0 },
      });

      await this.audit.record(
        {
          actorUserId,
          action: 'profile.taxonomy.create',
          targetType: 'TaxonomyTerm',
          targetId: term.id,
          reason: create.reason ?? null,
          meta: { kind: create.kind, key, label: create.label } as Prisma.InputJsonValue,
        },
        tx,
      );

      return this.serialiseTerm(term, 0);
    });
  }

  /**
   * Rename, re-key, activate/deactivate or reorder one term. Any of those can
   * change what a published profile shows, so the profiles using the term are
   * purged from the public site's cache. A re-key also rewrites the slug in
   * every template's suggested list in the same transaction.
   */
  async updateTaxonomy(actorUserId: bigint, idInput: string, input: unknown) {
    const update = parseTaxonomyUpdate(input);
    const id = this.termId(idInput);

    const { updated, usageCount, changed } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.taxonomyTerm.findUnique({
        where: { id },
        include: { _count: { select: { profiles: true } } },
      });
      if (!existing) throw new NotFoundException('Unknown term');
      const oldKey = existing.key;

      // Reason required for deactivation and re-keying
      const isDeactivating = update.isActive !== undefined && update.isActive === false && existing.isActive === true;
      const isRekeying = update.key !== undefined && update.key !== oldKey;
      if ((isDeactivating || isRekeying) && !update.reason) {
        throw new BadRequestException('Reason is required when deactivating or changing the key of a taxonomy term');
      }

      if (update.key !== undefined && update.key !== existing.key) {
        const clash = await tx.taxonomyTerm.findUnique({
          where: { kind_key: { kind: existing.kind, key: update.key } },
        });
        if (clash && clash.id !== id) throw new ConflictException('A term with this key already exists');
      }

      const data: Prisma.TaxonomyTermUpdateInput = {};
      const changed: (keyof UpdateTaxonomyInput)[] = [];
      if (update.label !== undefined) {
        data.label = update.label;
        changed.push('label');
      }
      if (update.key !== undefined) {
        data.key = update.key;
        changed.push('key');
      }
      if (update.isActive !== undefined) {
        data.isActive = update.isActive;
        changed.push('isActive');
      }
      if (update.sortOrder !== undefined) {
        data.sortOrder = update.sortOrder;
        changed.push('sortOrder');
      }

      const updated = await tx.taxonomyTerm.update({ where: { id }, data });

      // A re-key would orphan the slugs that templates store for suggestions,
      // so rewrite them in the same transaction.
      let cascadedTemplates = 0;
      if (update.key !== undefined && update.key !== oldKey) {
        const templates = await tx.profileTemplate.findMany({ select: { key: true, sections: true } });
        for (const template of templates) {
          const rewritten = rewriteSuggestedKey(template.sections, existing.kind, oldKey, update.key);
          if (!rewritten.changed) continue;
          await tx.profileTemplate.update({
            where: { key: template.key },
            data: { sections: rewritten.sections as Prisma.InputJsonValue },
          });
          cascadedTemplates += 1;
        }
      }

      await this.audit.record(
        {
          actorUserId,
          action: 'profile.taxonomy.update',
          targetType: 'TaxonomyTerm',
          targetId: id,
          reason: update.reason ?? null,
          meta: {
            kind: existing.kind,
            changed: changed.map(String),
            before: this.pick(existing, changed),
            after: this.pick(updated, changed),
            cascadedTemplates,
          } as Prisma.InputJsonValue,
        },
        tx,
      );

      return { updated, usageCount: existing._count?.profiles ?? 0, changed };
    });

    if (changed.length) await this.purgeProfilesUsingTerms([id]);
    return this.serialiseTerm(updated, usageCount);
  }

  /** Apply a drag-and-drop order to one kind. Every id must belong to that kind. */
  async reorderTaxonomy(actorUserId: bigint, input: unknown) {
    const reorder: ReorderTaxonomyInput = parseTaxonomyReorder(input);

    await this.prisma.$transaction(async (tx) => {
      const terms = await tx.taxonomyTerm.findMany({
        where: { id: { in: reorder.ids }, kind: reorder.kind },
        select: { id: true },
      });
      if (terms.length !== reorder.ids.length) {
        throw new BadRequestException('Every term must belong to the chosen kind');
      }

      for (const [index, id] of reorder.ids.entries()) {
        await tx.taxonomyTerm.update({ where: { id }, data: { sortOrder: index * 10 } });
      }

      await this.audit.record(
        {
          actorUserId,
          action: 'profile.taxonomy.reorder',
          targetType: 'TaxonomyKind',
          targetId: reorder.kind,
          reason: reorder.reason ?? null,
          meta: { kind: reorder.kind, ids: reorder.ids.map(String) } as Prisma.InputJsonValue,
        },
        tx,
      );
    });

    await this.purgeProfilesUsingTerms(reorder.ids);
    return this.listTaxonomy();
  }

  /** Published profiles whose page shows any of these terms, purged at once (§6.12). */
  private async purgeProfilesUsingTerms(termIds: bigint[]) {
    if (!termIds.length) return;
    const profiles = await this.prisma.practitionerProfile.findMany({
      where: { status: 'PUBLISHED', taxonomy: { some: { termId: { in: termIds } } } },
      select: { handle: true },
    });
    if (!profiles.length) return;

    const payload: PurgePayload = { tags: [...new Set(profiles.map((profile) => profileTag(profile.handle)))] };
    const job = await this.jobs.enqueue(PURGE_JOB, payload as never);
    if (job) await this.jobs.runNow(job.id);
  }

  private termId(value: string): bigint {
    if (!/^\d+$/.test(value)) throw new BadRequestException('Unknown term');
    return BigInt(value);
  }

  private serialiseTerm(row: Record<string, any>, usageCount = 0) {
    return {
      id: String(row.id),
      kind: row.kind as TaxonomyKind,
      key: row.key,
      label: row.label,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      usageCount,
    };
  }

  private pick(row: Record<string, unknown>, fields: readonly (keyof TemplateUpdateInput | keyof UpdateTaxonomyInput)[]) {
    const out: Record<string, unknown> = {};
    for (const field of fields) out[String(field)] = row[String(field)];
    return out;
  }

  private serialise(row: Record<string, any>) {
    return {
      key: row.key,
      title: row.title,
      description: row.description,
      kind: row.kind,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      sections: row.sections,
      updatedAt: row.updatedAt,
    };
  }
}