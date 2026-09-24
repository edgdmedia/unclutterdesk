import { describe, expect, it, vi } from 'vitest';
import { InstrumentService } from './instrument.service';
import { GAD_7 } from './builtin-instruments';

function setup(row: Record<string, unknown> | null = null) {
  const prisma: any = {
    assessmentInstrument: {
      createMany: vi.fn().mockResolvedValue({ count: 4 }),
      findUnique: vi.fn().mockResolvedValue(row),
      create: vi.fn(({ data }: any) => ({ version: 1, builtIn: false, updatedAt: new Date(), ...data })),
      update: vi.fn(({ data }: any) => ({ ...row, ...data, version: 2, updatedAt: new Date() })),
    },
  };
  return { prisma, service: new InstrumentService(prisma) };
}

describe('the instrument store', () => {
  // Admins own an instrument once it is stored; a deploy must not undo their edits.
  it('adds missing built-ins without touching stored ones', async () => {
    const { prisma, service } = setup();
    await service.onModuleInit();
    const call = prisma.assessmentInstrument.createMany.mock.calls[0][0];
    expect(call.skipDuplicates).toBe(true);
    expect(call.data.map((d: any) => d.key)).toEqual(['PHQ_9', 'GAD_7', 'PCL_5', 'DASS_21']);
  });

  it('does not stop the API starting if seeding fails', async () => {
    const { prisma, service } = setup();
    prisma.assessmentInstrument.createMany.mockRejectedValue(new Error('relation does not exist'));
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('adds a new instrument as a draft', async () => {
    const { prisma, service } = setup();
    await service.create({ ...GAD_7, key: 'GAD_2', items: GAD_7.items.slice(0, 2) });
    expect(prisma.assessmentInstrument.create.mock.calls[0][0].data.status).toBe('DRAFT');
  });

  it('refuses a definition with problems, and says what they are', async () => {
    const { service } = setup();
    await expect(service.create({ ...GAD_7, key: 'bad key' })).rejects.toMatchObject({
      response: { errors: expect.arrayContaining([expect.stringMatching(/key must be/)]) },
    });
  });

  it('bumps the version when the definition changes', async () => {
    const { prisma, service } = setup({ key: 'GAD_7', version: 1, status: 'PUBLISHED', builtIn: true, definition: GAD_7 });
    await service.update('GAD_7', { ...GAD_7, estimatedMinutes: 3 });
    expect(prisma.assessmentInstrument.update.mock.calls[0][0].data.version).toEqual({ increment: 1 });
  });

  it('will not change an instrument’s key', async () => {
    const { service } = setup({ key: 'GAD_7' });
    await expect(service.update('GAD_7', { ...GAD_7, key: 'GAD_8' })).rejects.toThrow(/cannot be changed/);
  });
});
