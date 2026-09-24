import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { AssessmentService } from './assessment.service';
import { BUILTIN_INSTRUMENTS } from './builtin-instruments';

const TENANT = 1n;

const stored = (key: string, overrides: Record<string, unknown> = {}) => ({
  key,
  version: 3,
  status: 'PUBLISHED',
  builtIn: true,
  definition: BUILTIN_INSTRUMENTS.find((d) => d.key === key)!,
  updatedAt: new Date(),
  ...overrides,
});

function setup(plan = 'STARTER') {
  const prisma: any = {
    tenantAssessment: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    profile: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([{ id: 7n }]) },
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ name: 'Calm Practice', slug: 'calm', customDomain: null, customDomainStatus: null, subscriptionTier: plan }),
    },
    assessmentAssignment: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    assessmentResponse: { create: vi.fn().mockResolvedValue({ id: 99n }), findMany: vi.fn() },
  };
  prisma.$transaction = vi.fn((fn: any) => fn(prisma));
  const notifications: any = {
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
    notify: vi.fn().mockResolvedValue([]),
  };
  const instruments: any = {
    published: vi.fn().mockResolvedValue(BUILTIN_INSTRUMENTS.map((d) => stored(d.key))),
    find: vi.fn((key: string) => Promise.resolve(BUILTIN_INSTRUMENTS.some((d) => d.key === key) ? stored(key) : null)),
    findMany: vi.fn((keys: string[]) => Promise.resolve(new Map(keys.map((k) => [k, stored(k)])))),
  };
  return { prisma, notifications, instruments, service: new AssessmentService(prisma, notifications, instruments) };
}

const assignment = (overrides: Record<string, unknown> = {}) => ({
  id: 5n,
  tenantId: TENANT,
  instrumentKey: 'PHQ_9',
  clientProfileId: 3n,
  sentByProfileId: 2n,
  status: 'SENT',
  message: 'Before Thursday, please.',
  completedAt: null,
  tenant: { name: 'Calm Practice', logoUrl: null, primaryColor: '#123', secondaryColor: null },
  client: { firstName: 'Ada' },
  response: null,
  ...overrides,
});

const phq = (value: number, overrides: Record<string, number> = {}) => ({
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`phq9_${i + 1}`, value])),
  ...overrides,
});

describe('AssessmentService', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  describe('library and plans', () => {
    it('marks what is switched on and what the plan allows', async () => {
      ctx.prisma.tenantAssessment.findMany.mockResolvedValue([{ instrumentKey: 'GAD_7' }]);
      const lib = await ctx.service.library(TENANT);
      expect(lib.map((i) => [i.key, i.enabled, i.onPlan])).toEqual([
        ['PHQ_9', false, true],
        ['GAD_7', true, true],
        ['PCL_5', false, false],
        ['DASS_21', false, false],
      ]);
      expect(lib[0]).not.toHaveProperty('scoring');
      expect(lib[0]).not.toHaveProperty('rules');
    });

    it('will not switch on a Pro assessment for a Starter practice', async () => {
      await expect(ctx.service.setEnabled(TENANT, 'PCL_5', true)).rejects.toThrow(/part of the Pro plan/);
      expect(ctx.prisma.tenantAssessment.upsert).not.toHaveBeenCalled();
    });

    it('lets a Pro practice switch it on', async () => {
      ctx = setup('PRO');
      await ctx.service.setEnabled(TENANT, 'PCL_5', true);
      expect(ctx.prisma.tenantAssessment.upsert).toHaveBeenCalled();
    });

    it('refuses an instrument that is not in the library', async () => {
      await expect(ctx.service.setEnabled(TENANT, 'MADE_UP', true)).rejects.toThrow(/not in the library/);
    });
  });

  describe('send', () => {
    beforeEach(() => {
      ctx.prisma.tenantAssessment.findUnique.mockResolvedValue({ instrumentKey: 'PHQ_9' });
      ctx.prisma.profile.findFirst.mockResolvedValue({ id: 3n, email: 'ada@example.com', firstName: 'Ada' });
      ctx.prisma.assessmentAssignment.create.mockImplementation(({ data }: any) => ({ id: 5n, status: 'SENT', ...data }));
    });

    it('needs the practice to have switched the instrument on', async () => {
      ctx.prisma.tenantAssessment.findUnique.mockResolvedValue(null);
      await expect(ctx.service.send(TENANT, 2n, { instrumentKey: 'PHQ_9', clientProfileId: '3' })).rejects.toThrow(/Switch PHQ-9 on/);
    });

    // A practice that dropped to Starter keeps the switch but cannot send.
    it('checks the plan again when sending', async () => {
      ctx.prisma.tenantAssessment.findUnique.mockResolvedValue({ instrumentKey: 'DASS_21' });
      await expect(ctx.service.send(TENANT, 2n, { instrumentKey: 'DASS_21', clientProfileId: '3' })).rejects.toThrow(/Pro plan/);
    });

    it('only finds clients in the sender’s own practice', async () => {
      ctx.prisma.profile.findFirst.mockResolvedValue(null);
      await expect(ctx.service.send(TENANT, 2n, { instrumentKey: 'PHQ_9', clientProfileId: '3' })).rejects.toThrow(/could not be found/);
      expect(ctx.prisma.profile.findFirst.mock.calls[0][0].where).toEqual({ id: 3n, tenantId: TENANT });
    });

    it('stores only a hash of the link token, with no expiry, and emails the link', async () => {
      const result = await ctx.service.send(TENANT, 2n, { instrumentKey: 'PHQ_9', clientProfileId: '3', message: ' See you Thursday ' });
      const token = result.link.split('/assessment/')[1];
      const data = ctx.prisma.assessmentAssignment.create.mock.calls[0][0].data;
      expect(data.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
      expect(data).not.toHaveProperty('expiresAt');
      expect(data.message).toBe('See you Thursday');
      expect(ctx.notifications.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ada@example.com', link: result.link }));
      expect(result.emailSent).toBe(true);
    });
  });

  describe('the emailed link', () => {
    it('shows the questions and the practitioner’s note, never the scoring', async () => {
      ctx.prisma.assessmentAssignment.findUnique.mockResolvedValue(assignment());
      const opened: any = await ctx.service.open('x'.repeat(43));
      expect(opened.status).toBe('OPEN');
      expect(opened.message).toBe('Before Thursday, please.');
      expect(opened.assessment.items).toHaveLength(9);
      expect(opened.assessment).not.toHaveProperty('scoring');
    });

    // Links get forwarded; results are shown after submitting and in the portal.
    it('does not show a result when a completed link is reopened', async () => {
      ctx.prisma.assessmentAssignment.findUnique.mockResolvedValue(
        assignment({ status: 'COMPLETED', response: { result: { client: { show: 'summary', summary: 'x', messages: [] } } } }),
      );
      const opened: any = await ctx.service.open('x'.repeat(43));
      expect(opened.status).toBe('COMPLETED');
      expect(opened).not.toHaveProperty('result');
    });

    it('refuses incomplete answers', async () => {
      ctx.prisma.assessmentAssignment.findUnique.mockResolvedValue(assignment());
      await expect(ctx.service.submit('x'.repeat(43), { phq9_1: 1 })).rejects.toThrow(/every question/);
      expect(ctx.prisma.assessmentResponse.create).not.toHaveBeenCalled();
    });

    it('stores a result only once', async () => {
      ctx.prisma.assessmentAssignment.findUnique.mockResolvedValue(assignment());
      ctx.prisma.assessmentAssignment.updateMany.mockResolvedValue({ count: 0 });
      await expect(ctx.service.submit('x'.repeat(43), phq(1))).rejects.toThrow(/already been completed/);
      expect(ctx.prisma.assessmentResponse.create).not.toHaveBeenCalled();
    });

    it('scores with the stored version, keeps the full result, and returns only the client’s part', async () => {
      ctx.prisma.assessmentAssignment.findUnique.mockResolvedValue(assignment());
      ctx.prisma.assessmentAssignment.updateMany.mockResolvedValue({ count: 1 });
      const done = await ctx.service.submit('x'.repeat(43), phq(1, { phq9_9: 0 }));
      const saved = ctx.prisma.assessmentResponse.create.mock.calls[0][0].data;
      expect([saved.totalScore, saved.severityLabel, saved.hasFlags, saved.instrumentVersion]).toEqual([8, 'Mild', false, 3]);
      expect(saved.result.clinicianText).toMatch(/Watchful waiting/);
      expect(done.result).toEqual(saved.result.client);
      expect(JSON.stringify(done)).not.toMatch(/Watchful waiting/);

      const sent = ctx.notifications.notify.mock.calls[0][0];
      expect(sent.profileIds).toEqual([2n]);
      expect(sent.type).toBe('assessments.completed');
      expect(sent.channels).toBeUndefined();
    });

    // A self-harm answer must reach a person, not wait in a bell.
    it('sends an urgent result to the sender and practice leads on every channel', async () => {
      ctx.prisma.assessmentAssignment.findUnique.mockResolvedValue(assignment());
      ctx.prisma.assessmentAssignment.updateMany.mockResolvedValue({ count: 1 });
      const done = await ctx.service.submit('x'.repeat(43), phq(0, { phq9_9: 2 }));
      const sent = ctx.notifications.notify.mock.calls[0][0];
      expect(sent.type).toBe('assessments.flagged');
      expect(sent.profileIds).toEqual([2n, 7n]);
      expect(sent.channels).toEqual({ in_app: true, email: true, push: true });
      expect(done.result.messages.join(' ')).toMatch(/112/);
    });
  });

  describe('the client portal', () => {
    it('only finds the signed-in client’s own assessments', async () => {
      ctx.prisma.assessmentAssignment.findFirst.mockResolvedValue(null);
      await expect(ctx.service.openMine(TENANT, 3n, 5n)).rejects.toThrow(/not found/);
      expect(ctx.prisma.assessmentAssignment.findFirst.mock.calls[0][0].where).toEqual({ id: 5n, tenantId: TENANT, clientProfileId: 3n });
    });

    it('shows the client their own result and the note', async () => {
      const client = { show: 'summary', summary: 'Some signs of low mood.', messages: [] };
      ctx.prisma.assessmentAssignment.findMany.mockResolvedValue([
        { id: 5n, instrumentKey: 'PHQ_9', status: 'COMPLETED', message: 'Note', createdAt: new Date(), completedAt: new Date(), response: { result: { client, clinicianText: 'secret' } } },
        { id: 6n, instrumentKey: 'GAD_7', status: 'SENT', message: null, createdAt: new Date(), completedAt: null, response: null },
      ]);
      const mine = await ctx.service.mine(TENANT, 3n);
      expect(mine.map((m) => [m.shortName, m.status, m.message])).toEqual([['PHQ-9', 'COMPLETED', 'Note'], ['GAD-7', 'SENT', null]]);
      expect(mine[0].result).toEqual(client);
      expect(JSON.stringify(mine)).not.toMatch(/secret/);
      expect(ctx.prisma.assessmentAssignment.findMany.mock.calls[0][0].where.clientProfileId).toBe(3n);
    });
  });
});
