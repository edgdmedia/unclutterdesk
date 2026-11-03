import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SECTION_ORDER, type SectionKey } from './completeness';
import {
  parseGuidanceUpdate,
  parseTemplateUpdate,
  type TemplateSectionsInput,
  type TemplateUpdateInput,
} from './profile-content.validation';

/**
 * Platform-admin editing of the profile templates and shared guidance
 * (spec §6.6). The seed migration inserts the starter content; after that the
 * database is the source of truth and every edit is written to the admin audit
 * log. Nothing here is tenant-scoped: templates and guidance are global.
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

@Injectable()
export class AdminProfileContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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

    const existing = await this.prisma.profileTemplate.findUnique({ where: { key } });
    if (!existing) throw new NotFoundException('Unknown template');

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

    const updated = await this.prisma.profileTemplate.update({ where: { key }, data });

    await this.audit.record({
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
    });

    return this.serialise(updated);
  }

  /**
   * Edit the shared guidance. The guidance is copied onto every template row so
   * the existing editor, which reads the selected template first, sees an edit
   * immediately without a read-path change.
   */
  async updateGuidance(actorUserId: bigint, input: unknown) {
    const update = parseGuidanceUpdate(input);
    const general = await this.prisma.profileTemplate.findUnique({
      where: { key: GENERAL_PROFILE_TEMPLATE_KEY },
      select: { sections: true },
    });
    if (!general) throw new NotFoundException('General profile guidance is missing');

    const before = guidanceFrom(general.sections);
    const after = { ...before, ...update.guidance };
    const rows = await this.prisma.profileTemplate.findMany({ select: { key: true, sections: true } });
    if (!rows.length) throw new NotFoundException('No profile templates exist');

    await this.prisma.$transaction(
      rows.map((row) =>
        this.prisma.profileTemplate.update({
          where: { key: row.key },
          data: { sections: withGuidance(row.sections, after) as Prisma.InputJsonValue },
        }),
      ),
    );

    await this.audit.record({
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
    });

    return { guidance: after };
  }

  private pick(row: Record<string, unknown>, fields: (keyof TemplateUpdateInput)[]) {
    const out: Record<string, unknown> = {};
    for (const field of fields) out[field as string] = row[field as string];
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