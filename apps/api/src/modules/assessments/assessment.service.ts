import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantWebOrigin } from '../../common/origins';
import { NotificationService } from '../notifications/notification.service';
import { InstrumentService, type StoredInstrument } from './instrument.service';
import { publicDefinition, score, tierIncludes, validateAnswers, type AssessmentResult } from './engine';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const PLAN_NAME = { STARTER: 'Starter', PRO: 'Pro', CLINIC: 'Clinic' } as const;

type AssignmentWithParties = Prisma.AssessmentAssignmentGetPayload<{
  include: {
    tenant: { select: { name: true; logoUrl: true; primaryColor: true; secondaryColor: true } };
    client: { select: { firstName: true } };
    response: true;
  };
}>;

/** The part of a stored result a client may see. */
function clientView(result: Prisma.JsonValue) {
  return ((result as unknown as AssessmentResult | null)?.client ?? { show: 'none', messages: [] }) as AssessmentResult['client'];
}

@Injectable()
export class AssessmentService {
  private readonly logger = new Logger(AssessmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly instruments: InstrumentService,
  ) {}

  private async plan(tenantId: bigint) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { subscriptionTier: true } });
    return tenant?.subscriptionTier ?? 'STARTER';
  }

  private assertOnPlan(plan: string, inst: StoredInstrument) {
    if (!tierIncludes(plan, inst.definition.tier)) {
      throw new ForbiddenException(
        `${inst.definition.shortName} is part of the ${PLAN_NAME[inst.definition.tier]} plan. Upgrade in Settings → Subscription to use it.`,
      );
    }
  }

  // ── The practice's library ───────────────────────────────────────────

  /** Every published instrument, whether this practice uses it, and whether its plan allows it. */
  async library(tenantId: bigint) {
    const [instruments, enabled, plan] = await Promise.all([
      this.instruments.published(),
      this.prisma.tenantAssessment.findMany({ where: { tenantId } }),
      this.plan(tenantId),
    ]);
    const on = new Set(enabled.map((e) => e.instrumentKey));
    return instruments.map((inst) => ({
      ...publicDefinition(inst.definition),
      enabled: on.has(inst.key),
      onPlan: tierIncludes(plan, inst.definition.tier),
    }));
  }

  async setEnabled(tenantId: bigint, key: string, enabled: boolean) {
    const inst = await this.instruments.find(key);
    if (!inst || inst.status !== 'PUBLISHED') throw new NotFoundException('That assessment is not in the library.');
    if (enabled) {
      this.assertOnPlan(await this.plan(tenantId), inst);
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
    const inst = await this.instruments.find(String(dto?.instrumentKey ?? ''));
    if (!inst || inst.status !== 'PUBLISHED') throw new BadRequestException('Choose an assessment from the library.');
    const def = inst.definition;

    const isEnabled = await this.prisma.tenantAssessment.findUnique({
      where: { tenantId_instrumentKey: { tenantId, instrumentKey: inst.key } },
    });
    if (!isEnabled) throw new BadRequestException(`Switch ${def.shortName} on in Assessments before sending it.`);
    // Checked again here: the practice may have moved to a lower plan since.
    this.assertOnPlan(await this.plan(tenantId), inst);

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
    const message = dto.message?.trim().slice(0, 1000) || null;
    const assignment = await this.prisma.assessmentAssignment.create({
      data: {
        tenantId,
        instrumentKey: inst.key,
        clientProfileId: client.id,
        sentByProfileId: senderProfileId,
        bookingId: dto.bookingId && /^\d+$/.test(dto.bookingId) ? BigInt(dto.bookingId) : null,
        tokenHash: hashToken(token),
        message,
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
          `It takes about ${def.estimatedMinutes} minutes. Your answers go only to your practitioner. ` +
          `You can also find it in your client portal.`,
        link,
        actionLabel: `Start ${def.shortName}`,
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

  // ── Completing: by emailed link, or signed in to the portal ──────────

  private readonly withParties = {
    tenant: { select: { name: true, logoUrl: true, primaryColor: true, secondaryColor: true } },
    client: { select: { firstName: true } },
    response: true,
  } as const;

  private async byToken(token: string): Promise<AssignmentWithParties> {
    if (!token || token.length < 20) throw new NotFoundException('This link is not valid.');
    const a = await this.prisma.assessmentAssignment.findUnique({ where: { tokenHash: hashToken(token) }, include: this.withParties });
    if (!a) throw new NotFoundException('This link is not valid.');
    return a;
  }

  private async ownAssignment(tenantId: bigint, profileId: bigint, id: bigint): Promise<AssignmentWithParties> {
    const a = await this.prisma.assessmentAssignment.findFirst({
      where: { id, tenantId, clientProfileId: profileId },
      include: this.withParties,
    });
    if (!a) throw new NotFoundException('Assessment not found');
    return a;
  }

  private async describe(a: AssignmentWithParties, { showResult }: { showResult: boolean }) {
    const practice = {
      name: a.tenant.name,
      logoUrl: a.tenant.logoUrl,
      primaryColor: a.tenant.primaryColor,
      secondaryColor: a.tenant.secondaryColor,
    };
    if (a.status === 'CANCELLED') return { status: 'CANCELLED' as const, practice };
    const inst = await this.instruments.find(a.instrumentKey);
    if (!inst) return { status: 'CANCELLED' as const, practice };
    if (a.status === 'COMPLETED') {
      return {
        status: 'COMPLETED' as const,
        practice,
        shortName: inst.definition.shortName,
        completedAt: a.completedAt?.toISOString() ?? null,
        ...(showResult && a.response ? { result: clientView(a.response.result) } : {}),
      };
    }
    return {
      status: 'OPEN' as const,
      practice,
      firstName: a.client.firstName,
      message: a.message,
      assessment: publicDefinition(inst.definition),
    };
  }

  /**
   * The questionnaire behind an emailed link. A completed link shows no result:
   * links get forwarded, so results are only shown straight after submitting,
   * and in the client's portal.
   */
  async open(token: string) {
    return this.describe(await this.byToken(token), { showResult: false });
  }

  async submit(token: string, rawAnswers: unknown) {
    return this.complete(await this.byToken(token), rawAnswers);
  }

  /** The signed-in client's own assessments: waiting, and done with what they may see. */
  async mine(tenantId: bigint, profileId: bigint) {
    const rows = await this.prisma.assessmentAssignment.findMany({
      where: { tenantId, clientProfileId: profileId, status: { in: ['SENT', 'COMPLETED'] } },
      include: { response: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const instruments = await this.instruments.findMany(rows.map((r) => r.instrumentKey));
    return rows
      .filter((r) => instruments.has(r.instrumentKey))
      .map((r) => {
        const def = instruments.get(r.instrumentKey)!.definition;
        return {
          id: r.id.toString(),
          shortName: def.shortName,
          name: def.name,
          measures: def.measures,
          estimatedMinutes: def.estimatedMinutes,
          status: r.status,
          message: r.message,
          sentAt: r.createdAt.toISOString(),
          completedAt: r.completedAt?.toISOString() ?? null,
          result: r.response ? clientView(r.response.result) : null,
        };
      });
  }

  async openMine(tenantId: bigint, profileId: bigint, id: bigint) {
    return this.describe(await this.ownAssignment(tenantId, profileId, id), { showResult: true });
  }

  async submitMine(tenantId: bigint, profileId: bigint, id: bigint, rawAnswers: unknown) {
    return this.complete(await this.ownAssignment(tenantId, profileId, id), rawAnswers);
  }

  /** Scores, stores, alerts the practice, and returns only what the client may see. */
  private async complete(a: AssignmentWithParties, rawAnswers: unknown) {
    if (a.status !== 'SENT') throw new BadRequestException('This assessment has already been completed or was cancelled.');
    const inst = await this.instruments.find(a.instrumentKey);
    if (!inst) throw new NotFoundException('This assessment is no longer available.');
    const def = inst.definition;

    const answers = validateAnswers(def, rawAnswers);
    if (typeof answers === 'string') throw new BadRequestException(answers);
    const result = score(def, answers);

    const response = await this.prisma.$transaction(async (tx) => {
      // Claimed in the UPDATE itself, so a double submit cannot store twice.
      const claimed = await tx.assessmentAssignment.updateMany({
        where: { id: a.id, status: 'SENT' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      if (claimed.count === 0) throw new BadRequestException('This assessment has already been completed or was cancelled.');
      return tx.assessmentResponse.create({
        data: {
          tenantId: a.tenantId,
          assignmentId: a.id,
          instrumentKey: inst.key,
          instrumentVersion: inst.version,
          clientProfileId: a.clientProfileId,
          answers: answers as Prisma.InputJsonValue,
          totalScore: result.totalScore,
          severityLabel: result.severity.label,
          severityLevel: result.severity.level,
          result: result as unknown as Prisma.InputJsonValue,
          hasFlags: result.flags.length > 0,
        },
      });
    });

    await this.tellClinicians(a, def.shortName, result);
    return { status: 'COMPLETED' as const, id: response.id.toString(), result: result.client };
  }

  /**
   * Lets the practice know a result is in. A flagged answer goes to the
   * sender and the practice's owners and admins; an urgent one (e.g. PHQ-9
   * item 9) by every channel they have, not just the bell.
   */
  private async tellClinicians(a: AssignmentWithParties, shortName: string, result: AssessmentResult) {
    try {
      const flags = result.flags;
      const urgent = flags.some((f) => f.level === 'urgent');
      const leads = await this.prisma.profile.findMany({
        where: { tenantId: a.tenantId, role: { in: ['OWNER', 'ADMIN'] }, status: 'active' },
        select: { id: true },
      });
      const sender = a.sentByProfileId ? [a.sentByProfileId] : [];
      const recipients = flags.length
        ? [...new Set([...sender, ...leads.map((l) => l.id)].map(String))].map(BigInt)
        : sender.length
          ? sender
          : leads.map((l) => l.id);
      if (!recipients.length) return;
      const who = a.client.firstName || 'A client';
      await this.notifications.notify({
        tenantId: a.tenantId,
        profileIds: recipients,
        type: flags.length ? 'assessments.flagged' : 'assessments.completed',
        title: flags.length ? `${who}'s ${shortName} needs your attention` : `${who} completed ${shortName}`,
        message: flags.length ? flags.map((f) => f.message).join(' ') : `Result: ${result.severity.label}.`,
        link: `/dashboard/clients/${a.clientProfileId}`,
        actionLabel: 'View result',
        ...(urgent ? { channels: { in_app: true, email: true, push: true } } : {}),
      });
    } catch (err) {
      this.logger.warn(`Could not notify about assessment ${a.id}: ${(err as Error).message}`);
    }
  }

  // ── Results, for the practice ────────────────────────────────────────

  /** A client's results over time, with the clinician's and the client's analysis, and what is still open. */
  async clientResults(tenantId: bigint, clientProfileId: bigint) {
    const [responses, pending] = await Promise.all([
      this.prisma.assessmentResponse.findMany({ where: { tenantId, clientProfileId }, orderBy: { completedAt: 'asc' } }),
      this.prisma.assessmentAssignment.findMany({
        where: { tenantId, clientProfileId, status: 'SENT' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const instruments = await this.instruments.findMany([...responses, ...pending].map((r) => r.instrumentKey));
    const name = (key: string) => instruments.get(key)?.definition.shortName ?? key;
    return {
      results: responses.map((r) => {
        const detail = r.result as unknown as Partial<AssessmentResult>;
        return {
          id: r.id.toString(),
          instrumentKey: r.instrumentKey,
          instrumentVersion: r.instrumentVersion,
          shortName: name(r.instrumentKey),
          totalScore: r.totalScore,
          maxScore: detail.maxScore ?? null,
          severity: r.severityLabel,
          severityLevel: r.severityLevel,
          clinicianText: detail.clinicianText ?? null,
          subscales: detail.subscales ?? [],
          flags: detail.flags ?? [],
          clientView: detail.client ?? null,
          answers: r.answers,
          completedAt: r.completedAt.toISOString(),
        };
      }),
      pending: pending.map((p) => ({
        id: p.id.toString(),
        instrumentKey: p.instrumentKey,
        shortName: name(p.instrumentKey),
        message: p.message,
        sentAt: p.createdAt.toISOString(),
      })),
    };
  }

  /** Everything sent across the practice, newest first: who has answered and what needs attention. */
  async practiceAssignments(tenantId: bigint) {
    const rows = await this.prisma.assessmentAssignment.findMany({
      where: { tenantId, status: { in: ['SENT', 'COMPLETED'] } },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        response: { select: { totalScore: true, severityLabel: true, severityLevel: true, hasFlags: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const instruments = await this.instruments.findMany(rows.map((r) => r.instrumentKey));
    return rows.map((r) => ({
      id: r.id.toString(),
      shortName: instruments.get(r.instrumentKey)?.definition.shortName ?? r.instrumentKey,
      client: { id: r.client.id.toString(), name: [r.client.firstName, r.client.lastName].filter(Boolean).join(' ') || 'Client' },
      status: r.status,
      sentAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      result: r.response
        ? { totalScore: r.response.totalScore, severity: r.response.severityLabel, severityLevel: r.response.severityLevel, hasFlags: r.response.hasFlags }
        : null,
    }));
  }
}
