import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AdminProfileContentService, GENERAL_PROFILE_TEMPLATE_KEY } from './admin-profile-content.service';

interface Row {
  key: string;
  title: string;
  description: string;
  kind: string | null;
  isActive: boolean;
  sortOrder: number;
  sections: Record<string, any>;
  updatedAt: Date;
}

function general(): Row {
  return {
    key: GENERAL_PROFILE_TEMPLATE_KEY,
    title: 'General',
    description: 'Guidance for every section.',
    kind: null,
    isActive: true,
    sortOrder: 0,
    sections: {
      guidance: { identity: 'Old identity guidance', about: 'Old about guidance' },
      sections: {},
      suggested: {},
    },
    updatedAt: new Date('2026-11-01T10:00:00Z'),
  };
}

function template(): Row {
  return {
    key: 'private-practice-counsellor',
    title: 'Counsellor in private practice',
    description: 'For counsellors seeing adults.',
    kind: 'COUNSELLOR',
    isActive: true,
    sortOrder: 10,
    sections: {
      guidance: { identity: 'Old identity guidance', about: 'Old about guidance' },
      sections: {
        identity: { prompt: 'Old prompt', example: 'Old example' },
        about: { prompt: 'Old about prompt', example: 'Old about example' },
      },
      suggested: { SPECIALTY: ['anxiety'] },
    },
    updatedAt: new Date('2026-11-01T10:00:00Z'),
  };
}

function setup() {
  const rows: Row[] = [general(), template()];
  const prisma: any = {
    profileTemplate: {
      findMany: vi.fn(async ({ where }: any = {}) => {
        const not = where?.key?.not;
        return rows.filter((row) => (not ? row.key !== not : true));
      }),
      findUnique: vi.fn(async ({ where }: any) => rows.find((row) => row.key === where.key) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const row = rows.find((candidate) => candidate.key === where.key);
        if (!row) throw new Error('missing row');
        Object.assign(row, data);
        return row;
      }),
    },
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  const audit: any = { record: vi.fn(async (entry: unknown) => entry) };
  return { service: new AdminProfileContentService(prisma, audit), prisma, audit, rows };
}

describe('AdminProfileContentService (§6.6)', () => {
  it('lists editable templates without the internal general row', async () => {
    const { service } = setup();
    const templates = await service.listTemplates();
    expect(templates.map((row) => row.key)).toEqual(['private-practice-counsellor']);
    expect(templates[0]).toMatchObject({ title: 'Counsellor in private practice', isActive: true });
  });

  it('returns the shared guidance from the general row', async () => {
    const { service } = setup();
    await expect(service.getGuidance()).resolves.toEqual({
      guidance: { identity: 'Old identity guidance', about: 'Old about guidance' },
    });
  });

  it('edits a template, preserves untouched content and writes an audit entry', async () => {
    const { service, prisma, audit } = setup();
    const updated = await service.updateTemplate(3n, 'private-practice-counsellor', {
      title: '  Updated title  ',
      reason: 'clarity pass',
      sections: { about: { prompt: 'New about prompt' } },
    });

    expect(updated.title).toBe('Updated title');
    expect(prisma.profileTemplate.update).toHaveBeenCalledOnce();
    const data = prisma.profileTemplate.update.mock.calls[0][0].data;
    expect(data.sections.guidance).toEqual({ identity: 'Old identity guidance', about: 'Old about guidance' });
    expect(data.sections.suggested).toEqual({ SPECIALTY: ['anxiety'] });
    expect(data.sections.sections.identity).toEqual({ prompt: 'Old prompt', example: 'Old example' });
    expect(data.sections.sections.about).toEqual({ prompt: 'New about prompt', example: 'Old about example' });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 3n,
        action: 'profile.template.update',
        targetType: 'ProfileTemplate',
        targetId: 'private-practice-counsellor',
        reason: 'clarity pass',
      }),
    );
    expect(audit.record.mock.calls[0][0].meta.changed).toEqual(['title', 'sections']);
  });

  it('clears an example when null is sent', async () => {
    const { service, prisma } = setup();
    await service.updateTemplate(3n, 'private-practice-counsellor', {
      sections: { about: { prompt: 'New about prompt', example: null } },
    });
    expect(prisma.profileTemplate.update.mock.calls[0][0].data.sections.sections.about).toEqual({
      prompt: 'New about prompt',
      example: null,
    });
  });

  it('edits shared guidance on every template so the editor sees it at once', async () => {
    const { service, prisma, audit } = setup();
    const result = await service.updateGuidance(3n, { guidance: { about: 'New about guidance' }, reason: 'tone' });

    expect(result.guidance).toEqual({ identity: 'Old identity guidance', about: 'New about guidance' });
    expect(prisma.profileTemplate.update).toHaveBeenCalledTimes(2);
    for (const call of prisma.profileTemplate.update.mock.calls) {
      expect(call[0].data.sections.guidance).toEqual({ identity: 'Old identity guidance', about: 'New about guidance' });
      expect(call[0].data.sections.suggested).toBeDefined();
    }
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 3n,
        action: 'profile.guidance.update',
        targetType: 'ProfileGuidance',
        targetId: GENERAL_PROFILE_TEMPLATE_KEY,
        reason: 'tone',
      }),
    );
  });

  it('rejects editing the internal general row as a template', async () => {
    const { service } = setup();
    await expect(service.updateTemplate(3n, GENERAL_PROFILE_TEMPLATE_KEY, { title: 'Nope' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('answers 404 for an unknown template', async () => {
    const { service } = setup();
    await expect(service.updateTemplate(3n, 'missing', { title: 'Nope' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('answers 404 when the general guidance row is missing', async () => {
    const { service, rows } = setup();
    rows.splice(0, 1);
    await expect(service.getGuidance()).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.updateGuidance(3n, { guidance: { about: 'Text' } })).rejects.toBeInstanceOf(NotFoundException);
  });
});