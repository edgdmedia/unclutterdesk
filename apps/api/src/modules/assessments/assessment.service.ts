import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantWebOrigin } from '../../common/origins';
import { NotificationService } from '../notifications/notification.service';
import { INSTRUMENTS, instrument, publicDefinition, validateAnswers } from './instruments';

/** How long a client has to complete an assessment they were sent. */
export const ASSESSMENT_LINK_DAYS = 14;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AssessmentService {
  private readonly logger = new Logger(AssessmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  // ── The practice's library ───────────────────────────────────────────

  /** Every instrument on the platform, with whether this practice uses it. */
  async library(tenantId: bigint) {
    const enabled = await this.prisma.tenantAssessment.findMany({ where: { tenantId } });
    const on = new Set(enabled.map((e) => e.instrumentKey));
    return INSTRUMENTS.map((inst) => ({ ...publicDefinition(inst), enabled: on.has(inst.key) }));
  }

  async setEnabled(tenantId: bigint, key: string, enabled: boolean) {
    if (!instrument(key)) throw new NotFoundException('That assessment is not in the library.');
    if (enabled) {
      await this.prisma.tenantAssessment.upsert({
        where: { tenantId_instrumentKey: { tenantId, instrumentKey: key } },
        create: { tenantId, instrumentKey: key },
        update: {},
      });
    } else {
      await this.prisma.tenantAssessment.deleteMany({ where: { tenantId, instrumentKey: key } });
    }
    return { key, enabled };
  }

  // ── Sending to a client ──────────────────────────────────────────────

  async send(
    tenantId: bigint,
    senderProfileId: bigint,
    dto: { instrumentKey?: string; clientProfileId?: string; bookingId?: string; message?: string },
  ) {
    const inst = instrument(String(dto?.instrumentKey ?? ''));
    if (!inst) throw new BadRequestException('Choose an assessment from the library.');

    const isEnabled = await this.prisma.tenantAssessment.findUnique({
      where: { tenantId_instrumentKey: { tenantId, instrumentKey: inst.key } },
    });
    if (!isEnabled) throw new BadRequestException(`Switch ${inst.shortName} on in Assessments before sending it.`);

    if (!/^\d+$/.test(String(dto.clientProfileId ?? ''))) throw new BadRequestException('Choose a client.');
    // The client id comes from the request; the practice comes from the session.
    const client = await this.prisma.profile.findFirst({
      where: { id: BigInt(dto.clientProfileId!), tenantId },
      select: { id: true, email: true, firstName: true },
    });
    if (!client) throw new NotFoundException('That client could not be found.');
    if (!client.email) throw new BadRequestException('This client has no email address to send the assessment to.');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true, customDomain: true, customDomainStatus: true },
    });
    if (!tenant) throw new NotFoundException('Practice not found');

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + ASSESSMENT_LINK_DAYS * 24 * 60 * 60 * 1000);
    const message = dto.message?.trim().slice(0, 500) || null;
    const assignment = await this.prisma.assessmentAssignment.create({
      data: {
        tenantId,
        instrumentKey: inst.key,
        clientProfileId: client.id,
        sentByProfileId: senderProfileId,
        bookingId: dto.bookingId && /^\d+$/.test(dto.bookingId) ? BigInt(dto.bookingId) : null,
        tokenHash: hashToken(token),
        message,
        expiresAt,
      },
    });

    const link = `${tenantWebOrigin(tenant)}/assessment/${token}`;
    let emailSent = false;
    try {
      const result = await this.notifications.sendEmail({
        to: client.email,
        type: 'assessments.sent',
        title: `${tenant.name} has sent you a short questionnaire`,
        message:
          `${message ? `${message}\n\n` : ''}` +
          `It takes about ${inst.estimatedMinutes} minutes. Your answers go only to your practitioner. ` +
          `The link works for ${ASSESSMENT_LINK_DAYS} days.`,
        link,
        actionLabel: `Start ${inst.shortName}`,
        tenantId,
        profileId: client.id,
      });
      emailSent = result.success === true;
    } catch (err) {
      this.logger.warn(`Assessment email to client ${client.id} failed: ${(err as Error).message}`);
    }

    return {
      id: assignment.id.toString(),
      instrumentKey: inst.key,
      status: assignment.status,
      expiresAt: expiresAt.toISOString(),
      emailSent,
      // Returned so staff can share it another way if the email does not arrive.
      link,
    };
  }

  async cancel(tenantId: bigint, assignmentId: bigint) {
    const updated = await this.prisma.assessmentAssignment.updateMany({
      where: { id: assignmentId, tenantId, status: 'SENT' },
      data: { status: 'CANCELLED' },
    });
    if (updated.count === 0) throw new NotFoundException('No open assessment to cancel.');
    return { id: assignmentId.toString(), status: 'CANCELLED' };
  }

  // ── The client's side, reached by link ───────────────────────────────

  private async byToken(token: string) {
    if (!token || token.length < 20) throw new NotFoundException('This link is not valid.');
    const assignment = await this.prisma.assessmentAssignment.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        tenant: { select: { name: true, logoUrl: true, primaryColor: true, secondaryColor: true } },
        client: { select: { firstName: true } },
      },
    });
    if (!assignment) throw new NotFoundException('This link is not valid.');
    return assignment;
  }

  /** The questionnaire, without any scoring, for the client to fill in. */
  async open(token: string) {
    const a = await this.byToken(token);
    const practice = {
      name: a.tenant.name,
      logoUrl: a.tenant.logoUrl,
      primaryColor: a.tenant.primaryColor,
      secondaryColor: a.tenant.secondaryColor,
    };
    if (a.status === 'COMPLETED') return { status: 'COMPLETED', practice };
    if (a.status === 'CANCELLED' || a.expiresAt <= new Date()) return { status: 'EXPIRED', practice };
    return {
      status: 'OPEN',
      practice,
      firstName: a.client.firstName,
      message: a.message,
      assessment: publicDefinition(instrument(a.instrumentKey)!),
    };
  }

  /**
   * Scores and stores the client's answers. The client never sees the score:
   * results are for the clinician to interpret.
   */
  async submit(token: string, rawAnswers: unknown) {
    const a = await this.byToken(token);
    const inst = instrument(a.instrumentKey);
    if (!inst) throw new NotFoundException('This assessment is no longer available.');

    const answers = validateAnswers(inst, rawAnswers);
    if (typeof answers === 'string') throw new BadRequestException(answers);
    const result = inst.score(answers);

    const response = await this.prisma.$transaction(async (tx) => {
      // Claimed in the UPDATE itself, so a double submit cannot store twice.
      const claimed = await tx.assessmentAssignment.updateMany({
        where: { id: a.id, status: 'SENT', expiresAt: { gt: new Date() } },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      if (claimed.count === 0) throw new BadRequestException('This assessment has already been completed or has expired.');
      return tx.assessmentResponse.create({
        data: {
          tenantId: a.tenantId,
          assignmentId: a.id,
          instrumentKey: inst.key,
          clientProfileId: a.clientProfileId,
          answers: answers as Prisma.InputJsonValue,
          totalScore: result.totalScore,
          severityLabel: result.severity.label,
          severityLevel: result.severity.level,
          result: { subscales: result.subscales, flags: result.flags, maxScore: result.maxScore } as unknown as Prisma.InputJsonValue,
          hasFlags: result.flags.length > 0,
        },
      });
    });

    await this.tellClinicians(a, inst.shortName, result.severity.label, result.flags);
    return { status: 'COMPLETED', id: response.id.toString() };
  }

  /**
   * Lets the practice know a result is in. A flagged answer (e.g. PHQ-9
   * item 9) goes to the sender and the practice's owners and admins by every
   * channel they have, not just the bell.
   */
  private async tellClinicians(
    a: { id: bigint; tenantId: bigint; sentByProfileId: bigint | null; clientProfileId: bigint; client: { firstName: string | null } },
    shortName: string,
    severity: string,
    flags: Array<{ message: string }>,
  ) {
    try {
      const leads = await this.prisma.profile.findMany({
        where: { tenantId: a.tenantId, role: { in: ['OWNER', 'ADMIN'] }, status: 'active' },
        select: { id: true },
      });
      const recipients = flags.length
        ? [...new Set([...(a.sentByProfileId ? [a.sentByProfileId] : []), ...leads.map((l) => l.id)].map(String))].map(BigInt)
        : a.sentByProfileId
          ? [a.sentByProfileId]
          : leads.map((l) => l.id);
      if (!recipients.length) return;
      const who = a.client.firstName || 'A client';
      await this.notifications.notify({
        tenantId: a.tenantId,
        profileIds: recipients,
        type: flags.length ? 'assessments.flagged' : 'assessments.completed',
        title: flags.length ? `${who}'s ${shortName} needs your attention` : `${who} completed ${shortName}`,
        message: flags.length ? flags.map((f) => f.message).join(' ') : `Result: ${severity}.`,
        link: `/dashboard/clients/${a.clientProfileId}`,
        actionLabel: 'View result',
        ...(flags.length ? { channels: { in_app: true, email: true, push: true } } : {}),
      });
    } catch (err) {
      this.logger.warn(`Could not notify about assessment ${a.id}: ${(err as Error).message}`);
    }
  }

  // ── Results ──────────────────────────────────────────────────────────

  /** A client's results over time, and anything still waiting to be completed. */
  async clientResults(tenantId: bigint, clientProfileId: bigint) {
    const [responses, pending] = await Promise.all([
      this.prisma.assessmentResponse.findMany({
        where: { tenantId, clientProfileId },
        orderBy: { completedAt: 'asc' },
      }),
      this.prisma.assessmentAssignment.findMany({
        where: { tenantId, clientProfileId, status: 'SENT', expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      results: responses.map((r) => {
        const inst = instrument(r.instrumentKey);
        const detail = r.result as { subscales?: unknown[]; flags?: unknown[]; maxScore?: number };
        return {
          id: r.id.toString(),
          instrumentKey: r.instrumentKey,
          shortName: inst?.shortName ?? r.instrumentKey,
          totalScore: r.totalScore,
          maxScore: detail.maxScore ?? null,
          severity: r.severityLabel,
          severityLevel: r.severityLevel,
          subscales: detail.subscales ?? [],
          flags: detail.flags ?? [],
          answers: r.answers,
          completedAt: r.completedAt.toISOString(),
        };
      }),
      pending: pending.map((p) => ({
        id: p.id.toString(),
        instrumentKey: p.instrumentKey,
        shortName: instrument(p.instrumentKey)?.shortName ?? p.instrumentKey,
        sentAt: p.createdAt.toISOString(),
        expiresAt: p.expiresAt.toISOString(),
      })),
    };
  }

  // ── Requests for new instruments ─────────────────────────────────────

  async request(tenantId: bigint, profileId: bigint, dto: { name?: string; details?: string }) {
    const name = String(dto?.name ?? '').trim();
    if (name.length < 2) throw new BadRequestException('Name the assessment you would like added.');
    const created = await this.prisma.assessmentRequest.create({
      data: {
        tenantId,
        requestedByProfileId: profileId,
        name: name.slice(0, 160),
        details: dto.details?.trim().slice(0, 2000) || null,
      },
    });
    return { id: created.id.toString(), name: created.name, status: created.status };
  }

  async practiceRequests(tenantId: bigint) {
    const rows = await this.prisma.assessmentRequest.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ({ id: r.id.toString(), name: r.name, details: r.details, status: r.status, adminNote: r.adminNote, createdAt: r.createdAt.toISOString() }));
  }

  async allRequests() {
    const rows = await this.prisma.assessmentRequest.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { tenant: { select: { name: true, slug: true } } },
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      name: r.name,
      details: r.details,
      status: r.status,
      adminNote: r.adminNote,
      createdAt: r.createdAt.toISOString(),
      practice: { id: r.tenantId.toString(), name: r.tenant.name, slug: r.tenant.slug },
    }));
  }

  async updateRequest(id: bigint, dto: { status?: string; adminNote?: string }) {
    const status = String(dto?.status ?? '').toUpperCase();
    if (!['OPEN', 'PLANNED', 'ADDED', 'DECLINED'].includes(status)) throw new BadRequestException('Unknown status.');
    const existing = await this.prisma.assessmentRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Request not found');
    const updated = await this.prisma.assessmentRequest.update({
      where: { id },
      data: { status, ...(dto.adminNote !== undefined ? { adminNote: dto.adminNote?.trim() || null } : {}) },
    });
    return { id: updated.id.toString(), status: updated.status, adminNote: updated.adminNote };
  }
}
