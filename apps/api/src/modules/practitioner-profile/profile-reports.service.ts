import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type PractitionerProfileStatus, type ProfileReportStatus, type ProfileReportType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { appOrigin } from '../../common/origins';
import { AuditService } from '../audit/audit.service';
import { JobsService } from '../jobs/jobs.service';
import { NotificationService } from '../notifications/notification.service';
import { HANDLE_PATTERN, normalizeHandle } from './handles';
import { SITEMAP_TAG, profileTag, queuePurge } from './profile-purge.job';

/**
 * "Report this profile" and the admin takedown queue (spec §6.15).
 *
 * Reports live in their own table, never in PlatformRequest (which needs a
 * practice) and never in the reported therapist's practice records. Anyone
 * can report a published profile; only platform admins read reports or act
 * on profiles, and every admin action is written to AdminAuditLog in the
 * same transaction as the change.
 */

/** What the public form may send. REMOVAL_REQUEST comes from the Phase 5 directory flow only. */
export const REPORT_TYPES: readonly ProfileReportType[] = ['IMPERSONATION', 'MISLEADING', 'UNSAFE', 'OTHER'];
export const REPORT_DETAILS_MAX = 2000;
export const REVIEW_NOTE_MAX = 1000;
export const MODERATION_REASON_MIN = 10;

export type ModerationAction = 'unpublish' | 'suspend' | 'restore';
export const MODERATION_ACTIONS: readonly ModerationAction[] = ['unpublish', 'suspend', 'restore'];

/**
 * Which status each admin action moves a profile from, and to.
 * - unpublish: off the web; the therapist can fix it and publish again.
 * - suspend: off the web with a 410; the therapist can't publish again.
 * - restore: lifts a suspension back to HIDDEN. Publishing is the therapist's own step.
 */
export const MODERATION_TRANSITIONS: Record<ModerationAction, { from: readonly PractitionerProfileStatus[]; to: PractitionerProfileStatus }> = {
  unpublish: { from: ['PUBLISHED'], to: 'HIDDEN' },
  suspend: { from: ['PUBLISHED', 'HIDDEN', 'DRAFT'], to: 'SUSPENDED' },
  restore: { from: ['SUSPENDED'], to: 'HIDDEN' },
};

export interface ReportInput {
  type?: unknown;
  details?: unknown;
  /** Honeypot: hidden from people, filled in by bots. */
  website?: unknown;
}

/** Plain text: control characters other than newlines and tabs removed, line endings normalised, trimmed. */
export function plainText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

function optionalText(value: unknown, max: number, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be text`);
  const text = plainText(value);
  if (text.length > max) throw new BadRequestException(`${field} must be ${max} characters or fewer`);
  return text || null;
}

function parseId(value: string, what: string): bigint {
  if (!/^\d{1,19}$/.test(value)) throw new NotFoundException(`${what} not found`);
  return BigInt(value);
}

const MODERATION_EMAIL: Record<ModerationAction, { title: string; message: (reason: string) => string }> = {
  unpublish: {
    title: 'Your profile has been taken off the web',
    message: (reason) =>
      `We've unpublished your Therapysts profile because it breaks our terms of use. Reason: ${reason}\n\nYou can edit your profile and publish it again once it's fixed. Reply to this email if you have questions.`,
  },
  suspend: {
    title: 'Your profile has been suspended',
    message: (reason) =>
      `We've suspended your Therapysts profile, so it can't be seen or published. Reason: ${reason}\n\nReply to this email if you think this is a mistake.`,
  },
  restore: {
    title: 'Your profile suspension has been lifted',
    message: (reason) =>
      `Your Therapysts profile is no longer suspended. Note: ${reason}\n\nIt isn't public yet: review it and publish it again when you're ready.`,
  },
};

@Injectable()
export class ProfileReportsService {
  private readonly logger = new Logger(ProfileReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * A report from the public profile page. Only published profiles can be
   * reported; anything else is a 404, so the form can't be used to find out
   * whether a hidden profile exists. A filled honeypot gets the same answer
   * and nothing is stored.
   */
  async submit(handleInput: string, input: ReportInput): Promise<{ received: true }> {
    const handle = normalizeHandle(String(handleInput ?? ''));
    if (!HANDLE_PATTERN.test(handle)) throw new NotFoundException('Profile not found');

    const type = input?.type;
    if (typeof type !== 'string' || !REPORT_TYPES.includes(type as ProfileReportType)) {
      throw new BadRequestException(`type must be one of ${REPORT_TYPES.join(', ')}`);
    }
    const details = optionalText(input?.details, REPORT_DETAILS_MAX, 'details');

    const profile = await this.prisma.practitionerProfile.findUnique({ where: { handle }, select: { id: true, status: true } });
    if (!profile || profile.status !== 'PUBLISHED') throw new NotFoundException('Profile not found');

    if (typeof input?.website === 'string' && input.website.trim() !== '') return { received: true };

    await this.prisma.profileReport.create({
      data: { profileId: profile.id, handle, type: type as ProfileReportType, details },
    });
    return { received: true };
  }

  /** The admin queue, newest first; OPEN by default. */
  async list(query: { status?: string; before?: string; take?: string }) {
    const status = (query.status ?? 'OPEN').toUpperCase();
    if (!['OPEN', 'ACTIONED', 'DISMISSED', 'ALL'].includes(status)) throw new BadRequestException('Unknown status');
    const take = Math.min(Math.max(Number.parseInt(query.take ?? '50', 10) || 50, 1), 100);
    const where: Prisma.ProfileReportWhereInput = {};
    if (status !== 'ALL') where.status = status as ProfileReportStatus;
    if (query.before) where.id = { lt: parseId(query.before, 'Report') };

    const rows = await this.prisma.profileReport.findMany({
      where,
      orderBy: { id: 'desc' },
      take,
      include: { profile: { select: { id: true, handle: true, displayName: true, status: true, _count: { select: { reports: { where: { status: 'OPEN' } } } } } } },
    });
    return {
      reports: rows.map((r) => ({
        id: r.id.toString(),
        handle: r.handle,
        type: r.type,
        details: r.details,
        reporterName: r.reporterName,
        reporterEmail: r.reporterEmail,
        relationship: r.relationship,
        status: r.status,
        reviewNote: r.reviewNote,
        reviewerUserId: r.reviewerUserId?.toString() ?? null,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
        profile: r.profile
          ? { id: r.profile.id.toString(), handle: r.profile.handle, displayName: r.profile.displayName, status: r.profile.status, openReports: r.profile._count.reports }
          : null,
      })),
      nextBefore: rows.length === take ? rows[rows.length - 1].id.toString() : null,
    };
  }

  /** Close an OPEN report without changing the profile (DISMISSED), or record that it was acted on (ACTIONED). */
  async resolve(actorUserId: bigint, reportIdInput: string, decision: unknown, noteInput: unknown) {
    if (decision !== 'ACTIONED' && decision !== 'DISMISSED') throw new BadRequestException('decision must be ACTIONED or DISMISSED');
    const reportId = parseId(reportIdInput, 'Report');
    const note = optionalText(noteInput, REVIEW_NOTE_MAX, 'note');

    return this.prisma.$transaction(async (tx) => {
      const closed = await tx.profileReport.updateMany({
        where: { id: reportId, status: 'OPEN' },
        data: { status: decision, reviewerUserId: actorUserId, reviewNote: note, reviewedAt: new Date() },
      });
      if (closed.count === 0) {
        const exists = await tx.profileReport.findUnique({ where: { id: reportId }, select: { id: true } });
        if (!exists) throw new NotFoundException('Report not found');
        throw new ConflictException('This report has already been reviewed');
      }
      await this.audit.record(
        {
          actorUserId,
          action: decision === 'ACTIONED' ? 'profile-report.action' : 'profile-report.dismiss',
          targetType: 'ProfileReport',
          targetId: reportId,
          reason: note,
        },
        tx,
      );
      return { id: reportId.toString(), status: decision };
    });
  }

  /**
   * Unpublish, suspend or restore a profile, with a reason. The status change,
   * the audit entry and (when a report is named) closing that report happen
   * in one transaction. Then the page is purged and the therapist is emailed;
   * a failed email is logged and doesn't undo the action.
   */
  async moderate(actorUserId: bigint, profileIdInput: string, action: unknown, input: { reason?: unknown; reportId?: unknown }) {
    if (typeof action !== 'string' || !MODERATION_ACTIONS.includes(action as ModerationAction)) {
      throw new BadRequestException(`action must be one of ${MODERATION_ACTIONS.join(', ')}`);
    }
    const act = action as ModerationAction;
    const profileId = parseId(profileIdInput, 'Profile');
    const reason = optionalText(input?.reason, REVIEW_NOTE_MAX, 'reason');
    if (!reason || reason.length < MODERATION_REASON_MIN) {
      throw new BadRequestException(`Give a reason of at least ${MODERATION_REASON_MIN} characters; the therapist sees it`);
    }
    const reportId = input?.reportId === undefined || input?.reportId === null || input?.reportId === '' ? null : parseId(String(input.reportId), 'Report');
    const { from, to } = MODERATION_TRANSITIONS[act];

    const result = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.practitionerProfile.findUnique({
        where: { id: profileId },
        select: { id: true, handle: true, status: true, user: { select: { email: true } } },
      });
      if (!profile) throw new NotFoundException('Profile not found');

      const changed = await tx.practitionerProfile.updateMany({ where: { id: profileId, status: { in: [...from] } }, data: { status: to } });
      if (changed.count === 0) throw new ConflictException(`Can't ${act} a profile that is ${profile.status.toLowerCase()}`);

      if (reportId !== null) {
        const closed = await tx.profileReport.updateMany({
          where: { id: reportId, profileId, status: 'OPEN' },
          data: { status: 'ACTIONED', reviewerUserId: actorUserId, reviewNote: reason, reviewedAt: new Date() },
        });
        if (closed.count === 0) throw new ConflictException('That report is not an open report about this profile');
      }

      await this.audit.record(
        {
          actorUserId,
          action: `profile.${act}`,
          targetType: 'PractitionerProfile',
          targetId: profileId,
          reason,
          meta: { from: profile.status, to, handle: profile.handle, reportId: reportId?.toString() ?? null },
        },
        tx,
      );
      return { handle: profile.handle, email: profile.user.email, from: profile.status };
    });

    await queuePurge(this.jobs, [profileTag(result.handle), SITEMAP_TAG]);
    await this.notifyPractitioner(result.email, act, reason);
    return { id: profileId.toString(), handle: result.handle, status: to };
  }

  private async notifyPractitioner(to: string, action: ModerationAction, reason: string) {
    const copy = MODERATION_EMAIL[action];
    try {
      const sent = await this.notifications.sendEmail({
        to,
        type: `profile.moderation.${action}`,
        title: copy.title,
        message: copy.message(reason),
        link: `${appOrigin()}/dashboard/profile`,
        actionLabel: 'Open your profile',
      });
      if (!sent.success) this.logger.warn(`Moderation email (${action}) not delivered: ${sent.error ?? 'unknown error'}`);
    } catch (err: any) {
      this.logger.warn(`Moderation email (${action}) failed: ${err?.message ?? err}`);
    }
  }
}
