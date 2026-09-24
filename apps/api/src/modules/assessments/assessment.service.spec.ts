import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { AssessmentService } from './assessment.service';

const TENANT = 1n;
const future = () => new Date(Date.now() + 86_400_000);

function setup() {
  const prisma: any = {
    tenantAssessment: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    profile: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([{ id: 7n }]) },
    tenant: { findUnique: vi.fn().mockResolvedValue({ name: 'Calm Practice', slug: 'calm', customDomain: null, customDomainStatus: null }) },
    assessmentAssignment: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    assessmentResponse: { create: vi.fn().mockResolvedValue({ id: 99n }), findMany: vi.fn() },
    assessmentRequest: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  };
  prisma.$transaction = vi.fn((fn: any) => fn(prisma));
  const notifications: any = {
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
    notify: vi.fn().mockResolvedValue([]),
  };
  return { prisma, notifications, service: new AssessmentService(prisma, notifications) };
}

const assignment = (overrides: Record<string, unknown> = {}) => ({
  id: 5n,
  tenantId: TENANT,
  instrumentKey: 'PHQ_9',
  clientProfileId: 3n,
  sentByProfileId: 2n,
  status: 'SENT',
  message: null,
  expiresAt: future(),
  tenant: { name: 'Calm Practice', logoUrl: null, primaryColor: '#123', secondaryColor: null },
  client: { firstName: 'Ada' },
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

  describe('library', () => {
    it('marks what the practice has switched on', async () => {
      ctx.prisma.tenantAssessment.findMany.mockResolvedValue([{ instrumentKey: 'GAD_7' }]);
      const lib = await ctx.service.library(TENANT);
      expect(lib.map((i) => [i.key, i.enabled])).toEqual([
        ['PHQ_9', false],
        ['GAD_7', true],
        ['PCL_5', false],
        ['DASS_21', false],
      ]);
      expect(lib[0]).not.toHaveProperty('score');
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

    it('only finds clients in the sender’s own practice', async () => {
      ctx.prisma.profile.findFirst.mockResolvedValue(null);
      await expect(ctx.service.send(TENANT, 2n, { instrumentKey: 'PHQ_9', clientProfileId: '3' })).rejects.toThrow(/could not be found/);
      expect(ctx.prisma.profile.findFirst.mock.calls[0][0].where).toEqual({ id: 3n, tenantId: TENANT });
    });

    it('stores only a hash of the link token and emails the link', async () => {
      const result = await ctx.service.send(TENANT, 2n, { instrumentKey: 'PHQ_9', clientProfileId: '3' });
      const token = result.link.split('/assessment/')[1];
      const stored = ctx.prisma.assessmentAssignment.create.mock.calls[0][0].data.tokenHash;
      expect(stored).toBe(createHash('sha256').update(token).digest('hex'));
      expect(stored).not.toContain(token);
      expect(ctx.notifications.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'ada@example.com', link: result.link, tenantId: TENANT }),
      );
      expect(result.emailSent).toBe(true);
    });
  });

  describe('the client’s link', () => {
    it('never includes scoring', async () => {
      ctx.prisma.assessmentAssignment.findUnique.mockResolvedValue(assignment());
      const opened: any = await ctx.service.open('x'.repeat(43));
      expect(opened.status).toBe('OPEN');
      expect(opened.assessment.items).toHaveLength(9);
      expect(opened.assessment).not.toHaveProperty('score');
    });

    it('reports an expired link as expired', async () => {
      ctx.prisma.assessmentAssignment.findUnique.mockResolvedValue(assignment({ expiresAt: new Date(Date.now() - 1000) }));
      expect((await ctx.service.open('x'.repeat(43))).status).toBe('EXPIRED');
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

    it('scores the answers and tells the sender', async () => {
      ctx.prisma.assessmentAssignment.findUnique.mockResolvedValue(assignment());
      ctx.prisma.assessmentAssignment.updateMany.mockResolvedValue({ count: 1 });
      await ctx.service.submit('x'.repeat(43), phq(1, { phq9_9: 0 }));
      const saved = ctx.prisma.assessmentResponse.create.mock.calls[0][0].data;
      expect([saved.totalScore, saved.severityLabel, saved.hasFlags]).toEqual([8, 'Mild', false]);
      const sent = ctx.notifications.notify.mock.calls[0][0];
      expect(sent.profileIds).toEqual([2n]);
      expect(sent.type).toBe('assessments.completed');
      expect(sent.channels).toBeUndefined();
    });

    // A self-harm answer must reach a person, not wait in a bell.
    it('sends a flagged result to the sender and practice leads on every channel', async () => {
      ctx.prisma.assessmentAssignment.findUnique.mockResolvedValue(assignment());
      ctx.prisma.assessmentAssignment.updateMany.mockResolvedValue({ count: 1 });
      await ctx.service.submit('x'.repeat(43), phq(0, { phq9_9: 2 }));
      const sent = ctx.notifications.notify.mock.calls[0][0];
      expect(sent.type).toBe('assessments.flagged');
      expect(sent.profileIds).toEqual([2n, 7n]);
      expect(sent.channels).toEqual({ in_app: true, email: true, push: true });
    });
  });

  describe('requests', () => {
    it('needs a name', async () => {
      await expect(ctx.service.request(TENANT, 2n, { name: ' ' })).rejects.toThrow(/Name the assessment/);
    });

    it('only accepts known statuses', async () => {
      await expect(ctx.service.updateRequest(1n, { status: 'DONE' })).rejects.toThrow(/Unknown status/);
    });
  });
});
