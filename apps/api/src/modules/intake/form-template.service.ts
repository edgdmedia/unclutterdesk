import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IntakeService } from './intake.service';
import { RequestService } from '../requests/request.service';

export type TemplateView = {
  id: string;
  title: string;
  description: string | null;
  targetType: string;
  questionCount: number;
  shareStatus: string;
  sharedBy: string | null;
  mine: boolean;
  timesUsed: number;
  schemaJson?: unknown;
};

type TemplateRow = {
  id: bigint;
  tenantId: bigint;
  title: string;
  description?: string | null;
  targetType: string;
  schemaJson: unknown;
  shareStatus: string;
  anonymous?: boolean;
  timesUsed?: number;
  tenant?: { name: string } | null;
};

const withTenantName = { tenant: { select: { name: true } } } as const;

/**
 * FRM-01: practices reuse good forms. A template is a frozen copy of a form,
 * so later edits to the form never change it; sharing puts it in front of
 * every practice once a platform admin approves it.
 */
@Injectable()
export class FormTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intake: IntakeService,
    private readonly requests: RequestService,
  ) {}

  private view(t: TemplateRow, tenantId: bigint | null, withSchema = false): TemplateView {
    const mine = tenantId !== null && t.tenantId === tenantId;
    return {
      id: t.id.toString(),
      title: t.title,
      description: t.description ?? null,
      targetType: t.targetType,
      questionCount: Array.isArray(t.schemaJson) ? t.schemaJson.length : 0,
      shareStatus: t.shareStatus,
      // Anonymous means anonymous: the name never leaves the server for other practices.
      sharedBy: mine ? null : t.anonymous ? 'a practice' : (t.tenant?.name ?? 'a practice'),
      mine,
      timesUsed: t.timesUsed ?? 0,
      ...(withSchema ? { schemaJson: t.schemaJson } : {}),
    };
  }

  async saveFromForm(tenantId: bigint, profileId: bigint, formId: bigint, opts: { share: boolean; anonymous: boolean }) {
    const form = await this.prisma.universalForm.findFirst({ where: { id: formId, tenantId } });
    if (!form) throw new NotFoundException('Form not found');
    if (!Array.isArray(form.schemaJson) || form.schemaJson.length === 0) {
      throw new BadRequestException('Add at least one question before saving this as a template.');
    }
    const template = await this.prisma.formTemplate.create({
      data: {
        tenantId,
        sourceFormId: form.id,
        createdByProfileId: profileId,
        title: form.title,
        description: form.description,
        targetType: form.targetType,
        schemaJson: form.schemaJson,
        shareStatus: opts.share ? 'PENDING' : 'PRIVATE',
        anonymous: !!opts.anonymous,
      },
      include: withTenantName,
    });
    if (opts.share) {
      await this.prisma.platformRequest.create({
        data: {
          tenantId,
          requestedByProfileId: profileId,
          type: 'TEMPLATE',
          subject: `Share form template: ${form.title}`.slice(0, 160),
          formTemplateId: template.id,
        },
      });
    }
    return this.view(template, tenantId);
  }

  async library(tenantId: bigint) {
    const [mine, shared] = await Promise.all([
      this.prisma.formTemplate.findMany({ where: { tenantId }, include: withTenantName, orderBy: { createdAt: 'desc' } }),
      this.prisma.formTemplate.findMany({
        where: { shareStatus: 'APPROVED', NOT: { tenantId } },
        include: withTenantName,
        orderBy: { timesUsed: 'desc' },
      }),
    ]);
    return { mine: mine.map((t) => this.view(t, tenantId)), shared: shared.map((t) => this.view(t, tenantId)) };
  }

  /** The practice's own templates in any state, or anyone's once approved. */
  private visible(tenantId: bigint, id: bigint) {
    return this.prisma.formTemplate.findFirst({
      where: { id, OR: [{ tenantId }, { shareStatus: 'APPROVED' }] },
      include: withTenantName,
    });
  }

  async preview(tenantId: bigint, id: bigint) {
    const template = await this.visible(tenantId, id);
    if (!template) throw new NotFoundException('Template not found');
    return this.view(template, tenantId, true);
  }

  async use(tenantId: bigint, id: bigint) {
    const template = await this.visible(tenantId, id);
    if (!template) throw new NotFoundException('Template not found');
    const form = await this.intake.createCustomForm(tenantId, {
      title: template.title,
      description: template.description ?? undefined,
      targetType: template.targetType,
      schemaJson: template.schemaJson as any[],
      isDefault: false,
    });
    await this.prisma.formTemplate.update({ where: { id: template.id }, data: { timesUsed: { increment: 1 } } });
    return { formId: String(form.id) };
  }

  async remove(tenantId: bigint, id: bigint) {
    const done = await this.prisma.formTemplate.deleteMany({ where: { id, tenantId } });
    if (done.count === 0) throw new NotFoundException('Template not found');
    await this.prisma.platformRequest.updateMany({
      where: { formTemplateId: id, status: 'OPEN' },
      data: { status: 'DECLINED', adminNote: 'Withdrawn by the practice.' },
    });
  }

  /**
   * Platform admin only; the controller guards it. The review request closes
   * through RequestService, which tells the practice the outcome.
   */
  async review(id: bigint, decision: 'APPROVED' | 'DECLINED', note?: string) {
    const template = await this.prisma.formTemplate.update({ where: { id }, data: { shareStatus: decision } });
    const requests = await this.prisma.platformRequest.findMany({ where: { formTemplateId: id } });
    for (const request of requests) {
      await this.requests.update(
        request.id,
        {
          status: decision === 'APPROVED' ? 'DONE' : 'DECLINED',
          adminNote: note ?? (decision === 'APPROVED' ? 'Approved. Every practice can now use it.' : 'Not approved for sharing.'),
        },
        { templateReview: true },
      );
    }
    return this.view(template, null);
  }

  /** Platform admin only: the real practice is always visible here. */
  async adminPreview(id: bigint) {
    const template = await this.prisma.formTemplate.findUnique({ where: { id }, include: withTenantName });
    if (!template) throw new NotFoundException('Template not found');
    return { ...this.view(template, null, true), practiceName: template.tenant?.name ?? '' };
  }
}
