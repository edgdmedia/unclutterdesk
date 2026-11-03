import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuditService } from '../audit/audit.service';
import { PURGE_JOB } from './profile-purge.job';
import { MODERATION_TRANSITIONS, ProfileReportsService, REPORT_DETAILS_MAX, plainText } from './profile-reports.service';

const ADMIN = 1n;

/**
 * The database is the boundary here (as in every API unit test): Prisma is
 * faked, while AuditService and the purge queueing are the real code.
 */
function setup(profile: Record<string, unknown> | null = { id: 50n, handle: 'folake', status: 'PUBLISHED', user: { email: 'folake@example.com' } }) {
  const prisma: any = {
    practitionerProfile: {
      findUnique: vi.fn().mockResolvedValue(profile),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    profileReport: {
      create: vi.fn(async ({ data }: any) => ({ id: 9n, ...data })),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    adminAuditLog: { create: vi.fn(async ({ data }: any) => ({ id: 3n, ...data })) },
  };
  prisma.$transaction = vi.fn(async (fn: (tx: any) => unknown) => fn(prisma));
  const jobs: any = { enqueue: vi.fn().mockResolvedValue({ id: 77n }), runNow: vi.fn().mockResolvedValue(undefined) };
  const notifications: any = { sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  const service = new ProfileReportsService(prisma, new AuditService(prisma), jobs, notifications);
  return { service, prisma, jobs, notifications };
}

describe('public reports', () => {
  it('stores a report about a published profile, with the handle as reported', async () => {
    const { service, prisma } = setup();
    await expect(service.submit('Folake', { type: 'IMPERSONATION', details: '  Not her photo.\r\nShe works elsewhere.  ' })).resolves.toEqual({ received: true });
    expect(prisma.profileReport.create).toHaveBeenCalledWith({
      data: { profileId: 50n, handle: 'folake', type: 'IMPERSONATION', details: 'Not her photo.\nShe works elsewhere.' },
    });
  });

  it('answers 404 for a profile that is not published, so hidden profiles stay undiscoverable', async () => {
    for (const status of ['DRAFT', 'HIDDEN', 'SUSPENDED']) {
      const { service, prisma } = setup({ id: 50n, handle: 'folake', status });
      await expect(service.submit('folake', { type: 'OTHER' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.profileReport.create).not.toHaveBeenCalled();
    }
    const { service } = setup(null);
    await expect(service.submit('nobody-here', { type: 'OTHER' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.submit('../etc', { type: 'OTHER' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses removal requests and unknown types from the public form', async () => {
    const { service, prisma } = setup();
    await expect(service.submit('folake', { type: 'REMOVAL_REQUEST' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.submit('folake', { type: 'spam' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.submit('folake', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.profileReport.create).not.toHaveBeenCalled();
  });

  it('limits details to plain text of a fixed length', async () => {
    const { service } = setup();
    await expect(service.submit('folake', { type: 'OTHER', details: 'x'.repeat(REPORT_DETAILS_MAX + 1) })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.submit('folake', { type: 'OTHER', details: { html: '<b>' } })).rejects.toBeInstanceOf(BadRequestException);
    expect(plainText('a\u0000b\u0007c\n\td')).toBe('abc\n\td');
  });

  it('accepts a filled honeypot silently and stores nothing', async () => {
    const { service, prisma } = setup();
    await expect(service.submit('folake', { type: 'OTHER', website: 'http://spam.example' })).resolves.toEqual({ received: true });
    expect(prisma.profileReport.create).not.toHaveBeenCalled();
  });
});

describe('admin queue', () => {
  it('lists OPEN reports by default, newest first, with the profile summary', async () => {
    const { service, prisma } = setup();
    prisma.profileReport.findMany.mockResolvedValue([
      {
        id: 9n, handle: 'folake', type: 'UNSAFE', details: 'd', reporterName: null, reporterEmail: null, relationship: null,
        status: 'OPEN', reviewNote: null, reviewerUserId: null, createdAt: new Date(0), reviewedAt: null,
        profile: { id: 50n, handle: 'folake', displayName: 'Folake', status: 'PUBLISHED', _count: { reports: 2 } },
      },
    ]);
    const out = await service.list({});
    expect(prisma.profileReport.findMany.mock.calls[0][0]).toMatchObject({ where: { status: 'OPEN' }, orderBy: { id: 'desc' }, take: 50 });
    expect(out.reports[0]).toMatchObject({ id: '9', profile: { id: '50', openReports: 2 } });
    await expect(service.list({ status: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('dismisses an open report once, and audits it in the same transaction', async () => {
    const { service, prisma } = setup();
    await expect(service.resolve(ADMIN, '9', 'DISMISSED', ' Not a breach. ')).resolves.toEqual({ id: '9', status: 'DISMISSED' });
    expect(prisma.profileReport.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 9n, status: 'OPEN' } }));
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorUserId: ADMIN, action: 'profile-report.dismiss', targetType: 'ProfileReport', targetId: '9', reason: 'Not a breach.' }),
    });

    prisma.profileReport.updateMany.mockResolvedValue({ count: 0 });
    prisma.profileReport.findUnique.mockResolvedValue({ id: 9n });
    await expect(service.resolve(ADMIN, '9', 'DISMISSED', null)).rejects.toBeInstanceOf(ConflictException);
    prisma.profileReport.findUnique.mockResolvedValue(null);
    await expect(service.resolve(ADMIN, '9', 'DISMISSED', null)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.resolve(ADMIN, '9', 'MAYBE', null)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('takedown', () => {
  it('suspends a profile, closes the report, audits, purges the page and emails the therapist', async () => {
    const { service, prisma, jobs, notifications } = setup();
    const out = await service.moderate(ADMIN, '50', 'suspend', { reason: 'Impersonating a registered psychologist.', reportId: '9' });
    expect(out).toEqual({ id: '50', handle: 'folake', status: 'SUSPENDED' });

    expect(prisma.practitionerProfile.updateMany).toHaveBeenCalledWith({
      where: { id: 50n, status: { in: ['PUBLISHED', 'HIDDEN', 'DRAFT'] } },
      data: { status: 'SUSPENDED' },
    });
    expect(prisma.profileReport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 9n, profileId: 50n, status: 'OPEN' }, data: expect.objectContaining({ status: 'ACTIONED' }) }),
    );
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'profile.suspend',
        targetType: 'PractitionerProfile',
        targetId: '50',
        metaJson: { from: 'PUBLISHED', to: 'SUSPENDED', handle: 'folake', reportId: '9' },
      }),
    });
    expect(jobs.enqueue).toHaveBeenCalledWith(PURGE_JOB, { tags: ['profile:folake', 'sitemap'] }, expect.anything());
    expect(jobs.runNow).toHaveBeenCalledWith(77n);
    expect(notifications.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'folake@example.com', type: 'profile.moderation.suspend', message: expect.stringContaining('Impersonating a registered psychologist.') }),
    );
  });

  it('needs a reason the therapist can read', async () => {
    const { service, prisma } = setup();
    await expect(service.moderate(ADMIN, '50', 'suspend', { reason: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.moderate(ADMIN, '50', 'suspend', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.moderate(ADMIN, '50', 'delete', { reason: 'A long enough reason' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses a move the profile is not in a state for, and writes nothing', async () => {
    const { service, prisma, jobs, notifications } = setup({ id: 50n, handle: 'folake', status: 'DRAFT', user: { email: 'f@example.com' } });
    prisma.practitionerProfile.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.moderate(ADMIN, '50', 'unpublish', { reason: 'Misleading claims about cure rates.' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
    expect(jobs.enqueue).not.toHaveBeenCalled();
    expect(notifications.sendEmail).not.toHaveBeenCalled();
  });

  it('refuses a report that is not an open report about this profile', async () => {
    const { service, prisma } = setup();
    prisma.profileReport.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.moderate(ADMIN, '50', 'unpublish', { reason: 'Misleading claims about cure rates.', reportId: '9' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('keeps the takedown when the email fails', async () => {
    const { service, notifications } = setup();
    notifications.sendEmail.mockRejectedValue(new Error('provider down'));
    await expect(service.moderate(ADMIN, '50', 'unpublish', { reason: 'Misleading claims about cure rates.' })).resolves.toMatchObject({ status: 'HIDDEN' });
  });

  it('restores a suspension to HIDDEN, never straight to PUBLISHED', () => {
    expect(MODERATION_TRANSITIONS.restore).toEqual({ from: ['SUSPENDED'], to: 'HIDDEN' });
    expect(MODERATION_TRANSITIONS.unpublish).toEqual({ from: ['PUBLISHED'], to: 'HIDDEN' });
  });

  it('treats a malformed id as not found', async () => {
    const { service } = setup();
    await expect(service.moderate(ADMIN, 'x', 'suspend', { reason: 'A long enough reason' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.resolve(ADMIN, '1; drop', 'DISMISSED', null)).rejects.toBeInstanceOf(NotFoundException);
  });
});
