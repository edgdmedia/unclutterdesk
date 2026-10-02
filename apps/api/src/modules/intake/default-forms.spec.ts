import { describe, expect, it, vi } from 'vitest';
import { DefaultFormsService } from './default-forms.service';
import { DEFAULT_FORMS, listPendingForms } from './default-forms';

/**
 * BKG-06 / FRM-04: every practice starts with five forms (intake, consent to
 * treatment, confidentiality, session feedback, public review) and keeps
 * whatever edits it has made to them.
 */
function make(existing: { systemKey: string | null; targetType?: string }[] = []) {
  const prisma: any = {
    universalForm: {
      findMany: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: 50n, ...data })),
    },
  };
  return { prisma, service: new DefaultFormsService(prisma) };
}

const created = (prisma: any) => prisma.universalForm.create.mock.calls.map((c: any[]) => c[0].data.systemKey);

describe('the default forms', () => {
  it('are the five agreed forms, each with its own type', () => {
    expect(DEFAULT_FORMS.map((f) => [f.systemKey, f.targetType])).toEqual([
      ['CLIENT_INTAKE', 'INTAKE'],
      ['CONSENT_TO_TREATMENT', 'CONSENT'],
      ['CONFIDENTIALITY', 'CONSENT'],
      ['SESSION_FEEDBACK', 'FEEDBACK'],
      ['PUBLIC_REVIEW', 'REVIEW'],
    ]);
  });

  it('a review form has a 1–5 rating and a testimonial, so it can be published', () => {
    const review = DEFAULT_FORMS.find((f) => f.systemKey === 'PUBLIC_REVIEW')!;
    const fields = review.schemaJson as Array<{ type: string; options?: string[]; required?: boolean }>;
    expect(fields.find((f) => f.type === 'scale')?.options).toEqual(['1', '2', '3', '4', '5']);
    expect(fields.find((f) => f.type === 'textarea')?.required).toBe(true);
  });

  it('consent to treatment and confidentiality each end with a signature', () => {
    for (const key of ['CONSENT_TO_TREATMENT', 'CONFIDENTIALITY']) {
      const fields = DEFAULT_FORMS.find((f) => f.systemKey === key)!.schemaJson as Array<{ type: string }>;
      expect(fields[fields.length - 1].type).toBe('signature');
    }
  });
});

describe('DefaultFormsService.ensureFor', () => {
  it('creates all five for a practice that has none', async () => {
    const { prisma, service } = make([]);
    await service.ensureFor(1n);
    expect(created(prisma)).toEqual(['CLIENT_INTAKE', 'CONSENT_TO_TREATMENT', 'CONFIDENTIALITY', 'SESSION_FEEDBACK', 'PUBLIC_REVIEW']);
    expect(prisma.universalForm.create.mock.calls[0][0].data.tenantId).toBe(1n);
  });

  it('a second call creates nothing', async () => {
    const { prisma, service } = make(DEFAULT_FORMS.map((f) => ({ systemKey: f.systemKey, targetType: f.targetType })));
    await service.ensureFor(1n);
    expect(prisma.universalForm.create).not.toHaveBeenCalled();
  });

  it('never overwrites a form the practice edited', async () => {
    const { prisma, service } = make([{ systemKey: 'CLIENT_INTAKE', targetType: 'INTAKE' }]);
    await service.ensureFor(1n);
    expect(created(prisma)).not.toContain('CLIENT_INTAKE');
  });

  it("doesn't add a review or feedback form when the practice already made its own", async () => {
    const { prisma, service } = make([
      { systemKey: null, targetType: 'REVIEW' },
      { systemKey: null, targetType: 'FEEDBACK' },
    ]);
    await service.ensureFor(1n);
    expect(created(prisma)).toEqual(['CLIENT_INTAKE', 'CONSENT_TO_TREATMENT', 'CONFIDENTIALITY']);
  });

  it('still adds consent to treatment beside a practice-made consent form, which may cover something else', async () => {
    const { prisma, service } = make([{ systemKey: null, targetType: 'CONSENT' }]);
    await service.ensureFor(1n);
    expect(created(prisma)).toContain('CONSENT_TO_TREATMENT');
  });
});

describe('listPendingForms', () => {
  it('asks for intake, consent and confidentiality before a first session, never review or feedback', async () => {
    const prisma: any = {
      universalForm: { findMany: vi.fn().mockResolvedValue([]) },
      universalFormSubmission: { findMany: vi.fn().mockResolvedValue([]) },
    };
    await listPendingForms(prisma, 1n, 5n);
    expect(prisma.universalForm.findMany.mock.calls[0][0].where.systemKey.in).toEqual(['CLIENT_INTAKE', 'CONSENT_TO_TREATMENT', 'CONFIDENTIALITY']);
  });
});
