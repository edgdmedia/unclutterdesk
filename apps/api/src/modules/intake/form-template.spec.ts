import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FormTemplateService } from './form-template.service';

/**
 * FRM-01: a practice saves a form as a template and may share it. Shared
 * templates reach other practices only after a platform admin approves them,
 * and using one gives the practice its own independent copy.
 */
const MINE = 1n;
const OTHER = 2n;
const questions = [{ id: 'q1', label: 'How are you sleeping?', type: 'text', required: true }];

function make(templates: any[] = []) {
  const prisma: any = {
    universalForm: {
      findFirst: vi.fn().mockResolvedValue({ id: 10n, tenantId: MINE, title: 'Sleep check', description: 'Short', targetType: 'INTAKE', schemaJson: questions }),
    },
    formTemplate: {
      create: vi.fn(async ({ data }: any) => ({ id: 50n, timesUsed: 0, ...data, tenant: { name: 'Calm Rooms' } })),
      findMany: vi.fn(async ({ where }: any) =>
        templates.filter((t) =>
          where.tenantId !== undefined ? t.tenantId === where.tenantId : t.shareStatus === where.shareStatus && t.tenantId !== where.NOT?.tenantId,
        ),
      ),
      findFirst: vi.fn(async ({ where }: any) =>
        templates.find(
          (t) =>
            t.id === where.id &&
            (where.OR ?? [where]).some(
              (w: any) => (w.tenantId === undefined || w.tenantId === t.tenantId) && (w.shareStatus === undefined || w.shareStatus === t.shareStatus),
            ),
        ) ?? null,
      ),
      update: vi.fn(async ({ data }: any) => ({ ...templates[0], ...data })),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    platformRequest: { create: vi.fn(), updateMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  };
  const intake: any = { createCustomForm: vi.fn().mockResolvedValue({ id: '77' }) };
  const requests: any = { update: vi.fn() };
  return { service: new FormTemplateService(prisma, intake, requests), prisma, intake, requests };
}

describe('form templates', () => {
  it('saves a frozen copy of the form, private by default', async () => {
    const { service, prisma } = make();
    const t = await service.saveFromForm(MINE, 9n, 10n, { share: false, anonymous: false });
    expect(prisma.formTemplate.create.mock.calls[0][0].data).toMatchObject({
      tenantId: MINE,
      sourceFormId: 10n,
      title: 'Sleep check',
      schemaJson: questions,
      shareStatus: 'PRIVATE',
    });
    expect(prisma.platformRequest.create).not.toHaveBeenCalled();
    expect(t.questionCount).toBe(1);
  });

  it('sharing queues it for review as a TEMPLATE request', async () => {
    const { service, prisma } = make();
    await service.saveFromForm(MINE, 9n, 10n, { share: true, anonymous: true });
    expect(prisma.formTemplate.create.mock.calls[0][0].data).toMatchObject({ shareStatus: 'PENDING', anonymous: true });
    expect(prisma.platformRequest.create.mock.calls[0][0].data).toMatchObject({ tenantId: MINE, type: 'TEMPLATE', formTemplateId: 50n });
  });

  it("refuses to template another practice's form", async () => {
    const { service, prisma } = make();
    prisma.universalForm.findFirst.mockResolvedValue(null);
    await expect(service.saveFromForm(MINE, 9n, 999n, { share: false, anonymous: false })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.universalForm.findFirst.mock.calls[0][0].where).toMatchObject({ id: 999n, tenantId: MINE });
  });

  it('refuses a form with no questions', async () => {
    const { service, prisma } = make();
    prisma.universalForm.findFirst.mockResolvedValue({ id: 10n, tenantId: MINE, title: 'Empty', targetType: 'INTAKE', schemaJson: [] });
    await expect(service.saveFromForm(MINE, 9n, 10n, { share: false, anonymous: false })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('saving the same form twice gives two separate templates', async () => {
    const { service, prisma } = make();
    await service.saveFromForm(MINE, 9n, 10n, { share: false, anonymous: false });
    await service.saveFromForm(MINE, 9n, 10n, { share: false, anonymous: false });
    expect(prisma.formTemplate.create).toHaveBeenCalledTimes(2);
  });

  it('the library shows my templates and only approved shared ones, hiding anonymous authors', async () => {
    const { service } = make([
      { id: 1n, tenantId: MINE, title: 'Mine', shareStatus: 'PRIVATE', anonymous: false, schemaJson: questions, timesUsed: 0, tenant: { name: 'Calm Rooms' } },
      { id: 2n, tenantId: OTHER, title: 'Approved', shareStatus: 'APPROVED', anonymous: false, schemaJson: questions, timesUsed: 3, tenant: { name: 'Lekki Minds' } },
      { id: 3n, tenantId: OTHER, title: 'Anon', shareStatus: 'APPROVED', anonymous: true, schemaJson: questions, timesUsed: 0, tenant: { name: 'Secret Clinic' } },
      { id: 4n, tenantId: OTHER, title: 'Pending', shareStatus: 'PENDING', anonymous: false, schemaJson: questions, timesUsed: 0, tenant: { name: 'Lekki Minds' } },
    ]);
    const lib = await service.library(MINE);
    expect(lib.mine.map((t) => t.title)).toEqual(['Mine']);
    expect(lib.shared.map((t) => t.title)).toEqual(['Approved', 'Anon']);
    expect(lib.shared[0].sharedBy).toBe('Lekki Minds');
    expect(lib.shared[1].sharedBy).toBe('a practice');
    expect(JSON.stringify(lib, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('Secret Clinic');
  });

  it('using an approved template creates my own copy', async () => {
    const { service, intake, prisma } = make([
      { id: 2n, tenantId: OTHER, title: 'Approved', description: null, targetType: 'INTAKE', shareStatus: 'APPROVED', schemaJson: questions, timesUsed: 3 },
    ]);
    await expect(service.use(MINE, 2n)).resolves.toEqual({ formId: '77' });
    expect(intake.createCustomForm).toHaveBeenCalledWith(MINE, expect.objectContaining({ title: 'Approved', schemaJson: questions, isDefault: false }));
    expect(prisma.formTemplate.update).toHaveBeenCalledWith(expect.objectContaining({ data: { timesUsed: { increment: 1 } } }));
  });

  it("can't use another practice's pending template", async () => {
    const { service, intake } = make([{ id: 4n, tenantId: OTHER, shareStatus: 'PENDING', schemaJson: questions }]);
    await expect(service.use(MINE, 4n)).rejects.toBeInstanceOf(NotFoundException);
    expect(intake.createCustomForm).not.toHaveBeenCalled();
  });

  it('removing a template withdraws its open review request', async () => {
    const { service, prisma } = make();
    await service.remove(MINE, 4n);
    expect(prisma.formTemplate.deleteMany).toHaveBeenCalledWith({ where: { id: 4n, tenantId: MINE } });
    expect(prisma.platformRequest.updateMany.mock.calls[0][0].where).toEqual({ formTemplateId: 4n, status: 'OPEN' });
  });

  it("can't remove another practice's template", async () => {
    const { service, prisma } = make();
    prisma.formTemplate.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove(MINE, 4n)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('admin review sets the template and closes its request, which tells the practice', async () => {
    const { service, prisma, requests } = make([{ id: 4n, tenantId: OTHER, shareStatus: 'PENDING', schemaJson: questions, tenant: { name: 'Lekki Minds' } }]);
    prisma.platformRequest.findMany.mockResolvedValue([{ id: 30n }]);
    await service.review(4n, 'APPROVED');
    expect(prisma.formTemplate.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 4n }, data: { shareStatus: 'APPROVED' } }));
    expect(prisma.platformRequest.findMany.mock.calls[0][0].where).toEqual({ formTemplateId: 4n });
    expect(requests.update).toHaveBeenCalledWith(30n, { status: 'DONE', adminNote: 'Approved. Every practice can now use it.' }, { templateReview: true });
  });

  it('the admin preview names the real practice, even for an anonymous share', async () => {
    const { service, prisma } = make();
    prisma.formTemplate.findUnique = vi.fn().mockResolvedValue({ id: 3n, tenantId: OTHER, title: 'Anon', shareStatus: 'PENDING', anonymous: true, schemaJson: questions, tenant: { name: 'Secret Clinic' } });
    const t = await service.adminPreview(3n);
    expect(t).toMatchObject({ practiceName: 'Secret Clinic', schemaJson: questions, questionCount: 1 });
  });

  it('the admin preview of a missing template is not found', async () => {
    const { service, prisma } = make();
    prisma.formTemplate.findUnique = vi.fn().mockResolvedValue(null);
    await expect(service.adminPreview(3n)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a declined template passes the admin note to the practice', async () => {
    const { service, prisma, requests } = make([{ id: 4n, tenantId: OTHER, shareStatus: 'PENDING', schemaJson: questions }]);
    prisma.platformRequest.findMany.mockResolvedValue([{ id: 30n }]);
    await service.review(4n, 'DECLINED', 'Needs a consent question.');
    expect(requests.update).toHaveBeenCalledWith(30n, { status: 'DECLINED', adminNote: 'Needs a consent question.' }, { templateReview: true });
  });
});
