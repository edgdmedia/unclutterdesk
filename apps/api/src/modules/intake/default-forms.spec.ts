import { describe, expect, it, vi } from 'vitest';
import { DefaultFormsService } from './default-forms.service';
import { DEFAULT_FORMS } from './default-forms';

/**
 * BKG-06: every practice gets the intake and confidentiality forms, and keeps
 * whatever edits it has made to them.
 */
function make(existing: { systemKey: string }[] = []) {
  const prisma: any = {
    universalForm: {
      findMany: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: 50n, ...data })),
    },
  };
  return { prisma, service: new DefaultFormsService(prisma) };
}

describe('DefaultFormsService.ensureFor', () => {
  it('creates both forms for a practice that has neither', async () => {
    const { prisma, service } = make([]);
    await service.ensureFor(1n);
    expect(prisma.universalForm.create).toHaveBeenCalledTimes(2);
    const keys = prisma.universalForm.create.mock.calls.map((c: any[]) => c[0].data.systemKey);
    expect(keys).toEqual(['CLIENT_INTAKE', 'CONFIDENTIALITY']);
    expect(prisma.universalForm.create.mock.calls[0][0].data.tenantId).toBe(1n);
  });

  it('a second call creates nothing', async () => {
    const { prisma, service } = make(DEFAULT_FORMS.map((f) => ({ systemKey: f.systemKey })));
    await service.ensureFor(1n);
    expect(prisma.universalForm.create).not.toHaveBeenCalled();
  });

  it('never overwrites a form the practice edited', async () => {
    const { prisma, service } = make([{ systemKey: 'CLIENT_INTAKE' }]);
    await service.ensureFor(1n);
    expect(prisma.universalForm.create).toHaveBeenCalledTimes(1);
    expect(prisma.universalForm.create.mock.calls[0][0].data.systemKey).toBe('CONFIDENTIALITY');
  });
});
