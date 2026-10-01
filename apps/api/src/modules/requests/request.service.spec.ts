import { describe, expect, it, vi } from 'vitest';
import { RequestService } from './request.service';

function setup(existing: Record<string, unknown> | null = null) {
  const prisma: any = {
    platformRequest: {
      create: vi.fn(({ data }: any) => ({ id: 1n, status: 'OPEN', adminNote: null, createdAt: new Date(), updatedAt: new Date(), ...data })),
      findUnique: vi.fn().mockResolvedValue(existing),
      update: vi.fn(({ data }: any) => ({ ...existing, ...data, updatedAt: new Date() })),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const notifications: any = { notify: vi.fn().mockResolvedValue([]) };
  return { prisma, notifications, service: new RequestService(prisma, notifications) };
}

const existing = {
  id: 4n, tenantId: 1n, requestedByProfileId: 2n, type: 'FEATURE', subject: 'Group sessions', details: null,
  status: 'OPEN', adminNote: null, createdAt: new Date(), updatedAt: new Date(),
};

describe('requests from practices', () => {
  it.each(['ASSESSMENT', 'FEATURE', 'SERVICE', 'FEEDBACK', 'OTHER'])('accepts a %s request', async (type) => {
    const { service } = setup();
    await expect(service.create(1n, 2n, { type: type.toLowerCase(), subject: 'Something' })).resolves.toMatchObject({ type, status: 'OPEN' });
  });

  it('only takes template shares from the form editor, never as a plain request', async () => {
    const { service, prisma } = setup();
    await expect(service.create(1n, 2n, { type: 'template', subject: 'My form' })).rejects.toThrow(/form editor/);
    expect(prisma.platformRequest.create).not.toHaveBeenCalled();
  });

  it('says which shared template a request is about', async () => {
    const { service, prisma } = setup();
    prisma.platformRequest.findMany.mockResolvedValue([{ ...existing, type: 'TEMPLATE', formTemplateId: 50n, tenant: { name: 'Calm Rooms', slug: 'calm' } }]);
    const [row] = await service.all({ type: 'TEMPLATE' });
    expect(prisma.platformRequest.findMany.mock.calls[0][0].where).toMatchObject({ type: 'TEMPLATE' });
    expect(row.formTemplateId).toBe('50');
  });

  it("won't change a template request outside its review, so the two can't drift apart", async () => {
    const { service, prisma } = setup({ ...existing, type: 'TEMPLATE', formTemplateId: 50n });
    await expect(service.update(4n, { status: 'done' })).rejects.toThrow(/approve or decline/i);
    expect(prisma.platformRequest.update).not.toHaveBeenCalled();
    await expect(service.update(4n, { status: 'done' }, { templateReview: true })).resolves.toMatchObject({ status: 'DONE' });
  });

  it('tells a practice its template was approved or not, in those words', async () => {
    const template = { ...existing, type: 'TEMPLATE', subject: 'Telehealth Consent', formTemplateId: 50n };
    const approved = setup(template);
    await approved.service.update(4n, { status: 'DONE', adminNote: 'Approved.' }, { templateReview: true });
    expect(approved.notifications.notify.mock.calls[0][0].title).toBe('Form template "Telehealth Consent" is approved');
    const declined = setup(template);
    await declined.service.update(4n, { status: 'DECLINED', adminNote: 'Needs consent.' }, { templateReview: true });
    expect(declined.notifications.notify.mock.calls[0][0].title).toBe('Form template "Telehealth Consent" is not approved');
  });

  it('needs a known type and a title', async () => {
    const { service } = setup();
    await expect(service.create(1n, 2n, { type: 'SHOPPING', subject: 'x y' })).rejects.toThrow(/what kind/);
    await expect(service.create(1n, 2n, { type: 'FEATURE', subject: ' ' })).rejects.toThrow(/short title/);
  });

  it('tells the person who asked when the status changes', async () => {
    const { service, notifications } = setup(existing);
    await service.update(4n, { status: 'planned', adminNote: 'Coming in November.' });
    const sent = notifications.notify.mock.calls[0][0];
    expect(sent.profileIds).toEqual([2n]);
    expect(sent.title).toBe('Feature "Group sessions" is planned');
    expect(sent.message).toBe('Coming in November.');
  });

  it('stays quiet when nothing the practice sees has changed', async () => {
    const { service, notifications } = setup(existing);
    await service.update(4n, { status: 'OPEN' });
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('only accepts known statuses', async () => {
    const { service } = setup(existing);
    await expect(service.update(4n, { status: 'MAYBE' })).rejects.toThrow(/Unknown status/);
  });
});
