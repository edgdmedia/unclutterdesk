import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

type FormField = {
  id?: string;
  label?: string;
  type?: string;
  required?: boolean;
  options?: string[];
};

type DerivedAssessmentPayload = {
  instrument: 'PHQ_9';
  totalScore: number;
  severity: 'Minimal' | 'Mild' | 'Moderate' | 'Moderately severe' | 'Severe';
  item9Risk: boolean;
} | {
  instrument: 'GAD_7';
  totalScore: number;
  severity: 'Minimal' | 'Mild' | 'Moderate' | 'Severe';
} | null;

@Injectable()
export class IntakeService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeTargetType(targetType?: string) {
    return (targetType || 'INTAKE').toUpperCase();
  }

  private normalizePublicationMode(mode?: string) {
    return (mode || 'MANUAL').toUpperCase() === 'AUTO' ? 'AUTO' : 'MANUAL';
  }

  private normalizeReviewerDisplayMode(mode?: string) {
    return (mode || 'FIRST_NAME').toUpperCase() === 'ANONYMOUS' ? 'ANONYMOUS' : 'FIRST_NAME';
  }

  private mapForm(form: {
    id: bigint;
    title: string;
    slug?: string | null;
    systemKey?: string | null;
    description: string | null;
    targetType: string;
    schemaJson: unknown;
    isDefault: boolean;
    isActive: boolean;
    reviewPublicationMode: string;
    reviewerDisplayMode: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: form.id.toString(),
      title: form.title,
      slug: form.slug || null,
      systemKey: form.systemKey || null,
      description: form.description,
      targetType: form.targetType,
      schemaJson: form.schemaJson,
      isDefault: form.isDefault,
      isActive: form.isActive,
      reviewPublicationMode: form.reviewPublicationMode,
      reviewerDisplayMode: form.reviewerDisplayMode,
      createdAt: form.createdAt.toISOString(),
      updatedAt: form.updatedAt.toISOString(),
    };
  }

  private deriveReviewPayload(schemaJson: unknown, answersJson: unknown) {
    const fields = Array.isArray(schemaJson) ? (schemaJson as FormField[]) : [];
    const answers = answersJson && typeof answersJson === 'object' ? (answersJson as Record<string, unknown>) : {};

    const ratingField = fields.find((field) => {
      const type = (field.type || '').toLowerCase();
      return type.includes('likert') || type.includes('scale') || type.includes('rating');
    });
    const testimonialField = fields.find((field) => {
      const type = (field.type || '').toLowerCase();
      return type === 'textarea' || type.includes('long text');
    });

    const rawRating = ratingField?.id ? answers[ratingField.id] : undefined;
    const rating = typeof rawRating === 'number'
      ? rawRating
      : typeof rawRating === 'string'
        ? Number.parseFloat(rawRating)
        : null;
    const rawTestimonial = testimonialField?.id ? answers[testimonialField.id] : undefined;
    const testimonial = typeof rawTestimonial === 'string' ? rawTestimonial : '';

    return {
      rating: Number.isFinite(rating) ? Number(rating) : null,
      ratingLabel: ratingField?.label || 'Overall rating',
      testimonial,
      testimonialLabel: testimonialField?.label || 'Testimonial',
    };
  }

  private formatAnswerEntries(schemaJson: unknown, answersJson: unknown) {
    const fields = Array.isArray(schemaJson) ? (schemaJson as FormField[]) : [];
    const answers = answersJson && typeof answersJson === 'object' ? (answersJson as Record<string, unknown>) : {};

    return Object.entries(answers).map(([fieldId, value]) => {
      const field = fields.find((entry) => entry.id === fieldId);
      return {
        id: fieldId,
        label: field?.label || fieldId,
        type: field?.type || 'text',
        value,
      };
    });
  }

  private deriveAssessmentPayload(form: { systemKey?: string | null } | null | undefined, answersJson: unknown): DerivedAssessmentPayload {
    const answers = answersJson && typeof answersJson === 'object' ? (answersJson as Record<string, unknown>) : {};
    if (form?.systemKey === 'PHQ_9') {
      const orderedKeys = ['phq9_1', 'phq9_2', 'phq9_3', 'phq9_4', 'phq9_5', 'phq9_6', 'phq9_7', 'phq9_8', 'phq9_9'];
      const numeric = orderedKeys.map((key) => {
        const raw = answers[key];
        if (typeof raw === 'number') return raw;
        if (typeof raw === 'string') return Number.parseInt(raw, 10);
        return NaN;
      });

      if (numeric.some((value) => !Number.isInteger(value) || value < 0 || value > 3)) return null;

      const totalScore = numeric.reduce((sum, value) => sum + value, 0);
      const severity = totalScore <= 4
        ? 'Minimal'
        : totalScore <= 9
          ? 'Mild'
          : totalScore <= 14
            ? 'Moderate'
            : totalScore <= 19
              ? 'Moderately severe'
              : 'Severe';

      return {
        instrument: 'PHQ_9',
        totalScore,
        severity,
        item9Risk: numeric[8] > 0,
      };
    }

    if (form?.systemKey === 'GAD_7') {
      const orderedKeys = ['gad7_1', 'gad7_2', 'gad7_3', 'gad7_4', 'gad7_5', 'gad7_6', 'gad7_7'];
      const numeric = orderedKeys.map((key) => {
        const raw = answers[key];
        if (typeof raw === 'number') return raw;
        if (typeof raw === 'string') return Number.parseInt(raw, 10);
        return NaN;
      });

      if (numeric.some((value) => !Number.isInteger(value) || value < 0 || value > 3)) return null;

      const totalScore = numeric.reduce((sum, value) => sum + value, 0);
      const severity = totalScore <= 4
        ? 'Minimal'
        : totalScore <= 9
          ? 'Mild'
          : totalScore <= 14
            ? 'Moderate'
            : 'Severe';

      return {
        instrument: 'GAD_7',
        totalScore,
        severity,
      };
    }

    return null;
  }

  async getPublicForms(tenantId: bigint, targetType?: string) {
    const where = {
      tenantId,
      isActive: true,
      ...(targetType ? { targetType: this.normalizeTargetType(targetType) } : {}),
    };

    const forms = await this.prisma.universalForm.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    return forms.map((form) => this.mapForm(form));
  }

  async getForms(tenantId: bigint) {
    const forms = await this.prisma.universalForm.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return forms.map((form) => this.mapForm(form));
  }

  async getFormById(tenantId: bigint, formId: bigint) {
    const form = await this.prisma.universalForm.findFirst({
      where: { id: formId, tenantId },
    });

    if (!form) throw new NotFoundException('Form not found');
    return this.mapForm(form);
  }

  async createCustomForm(tenantId: bigint, dto: {
    title: string;
    description?: string;
    targetType?: string;
    schemaJson: any[];
    isDefault?: boolean;
    reviewPublicationMode?: string;
    reviewerDisplayMode?: string;
  }) {
    if (!dto.title || !Array.isArray(dto.schemaJson)) {
      throw new BadRequestException('Valid title and question fields schema are required');
    }

    const targetType = this.normalizeTargetType(dto.targetType);
    const form = await this.prisma.universalForm.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        targetType,
        schemaJson: dto.schemaJson,
        reviewPublicationMode: targetType === 'REVIEW' ? this.normalizePublicationMode(dto.reviewPublicationMode) : 'MANUAL',
        reviewerDisplayMode: targetType === 'REVIEW' ? this.normalizeReviewerDisplayMode(dto.reviewerDisplayMode) : 'FIRST_NAME',
        isDefault: dto.isDefault || false,
        isActive: true,
      },
    });

    return this.mapForm(form);
  }

  async updateForm(tenantId: bigint, formId: bigint, dto: {
    title?: string;
    description?: string;
    targetType?: string;
    schemaJson?: any[];
    isActive?: boolean;
    reviewPublicationMode?: string;
    reviewerDisplayMode?: string;
  }) {
    const existing = await this.prisma.universalForm.findFirst({ where: { id: formId, tenantId } });
    if (!existing) throw new NotFoundException('Form not found');

    if (existing.systemKey) {
      const isTryingToEditLockedFields =
        dto.title !== undefined ||
        dto.description !== undefined ||
        dto.targetType !== undefined ||
        dto.schemaJson !== undefined ||
        dto.reviewPublicationMode !== undefined ||
        dto.reviewerDisplayMode !== undefined;

      if (isTryingToEditLockedFields) {
        throw new BadRequestException('System templates can only be activated or paused; their schema and identity fields are locked.');
      }
    }

    const targetType = this.normalizeTargetType(dto.targetType || existing.targetType);
    const form = await this.prisma.universalForm.update({
      where: { id: formId },
      data: {
        title: dto.title?.trim() ?? existing.title,
        description: dto.description !== undefined ? dto.description?.trim() || null : existing.description,
        targetType,
        schemaJson: dto.schemaJson ?? existing.schemaJson,
        isActive: dto.isActive ?? existing.isActive,
        reviewPublicationMode: targetType === 'REVIEW'
          ? this.normalizePublicationMode(dto.reviewPublicationMode || existing.reviewPublicationMode)
          : 'MANUAL',
        reviewerDisplayMode: targetType === 'REVIEW'
          ? this.normalizeReviewerDisplayMode(dto.reviewerDisplayMode || existing.reviewerDisplayMode)
          : 'FIRST_NAME',
      },
    });

    return this.mapForm(form);
  }

  async submitIntakeAnswers(tenantId: bigint, dto: {
    formId: string;
    bookingId?: string;
    clientEmail: string;
    clientName?: string;
    answersJson: Record<string, any>;
  }) {
    const formId = BigInt(dto.formId);
    const email = dto.clientEmail.toLowerCase().trim();

    const form = await this.prisma.universalForm.findFirst({
      where: { id: formId, tenantId },
    });
    if (!form) throw new NotFoundException('Form not found');

    const [firstName, ...restName] = (dto.clientName || '').trim().split(/\s+/).filter(Boolean);
    const lastName = restName.join(' ');

    let clientProfile = await this.prisma.profile.findFirst({
      where: { tenantId, email },
    });
    if (!clientProfile) {
      clientProfile = await this.prisma.profile.create({
        data: {
          tenantId,
          email,
          username: email.split('@')[0],
          type: 'user',
          role: 'CLIENT',
          status: 'active',
          firstName: firstName || null,
          lastName: lastName || null,
        },
      });
    } else if (firstName && !clientProfile.firstName && !clientProfile.lastName) {
      clientProfile = await this.prisma.profile.update({
        where: { id: clientProfile.id },
        data: {
          firstName,
          lastName: lastName || null,
        },
      });
    }

    const status = form.targetType === 'REVIEW' && form.reviewPublicationMode === 'AUTO' ? 'PUBLISHED' : 'UNREAD';
    const now = new Date();
    const derived = this.deriveAssessmentPayload(form, dto.answersJson);

    const submission = await this.prisma.universalFormSubmission.create({
      data: {
        tenantId,
        formId,
        bookingId: dto.bookingId ? BigInt(dto.bookingId) : null,
        clientProfileId: clientProfile.id,
        targetType: form.targetType,
        status,
        reviewedAt: null,
        publishedAt: status === 'PUBLISHED' ? now : null,
        answersJson: dto.answersJson,
        derivedJson: derived,
      },
    });

    return {
      id: submission.id.toString(),
      formTitle: form.title,
      targetType: form.targetType,
      status: submission.status,
      submittedAt: submission.createdAt.toISOString(),
      derived,
    };
  }

  async getTenantSubmissions(tenantId: bigint, targetType?: string) {
    const submissions = await this.prisma.universalFormSubmission.findMany({
      where: {
        tenantId,
        ...(targetType ? { targetType: this.normalizeTargetType(targetType) } : {}),
      },
      include: {
        form: true,
        booking: {
          include: {
            service: true,
          },
        },
        tenant: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const clientIds = Array.from(new Set(submissions.map((submission) => submission.clientProfileId.toString()))).map((id) => BigInt(id));
    const clients = clientIds.length
      ? await this.prisma.profile.findMany({
          where: { tenantId, id: { in: clientIds } },
        })
      : [];

    const clientMap = new Map(clients.map((client) => [client.id.toString(), client]));

    return submissions.map((submission) => {
      const client = clientMap.get(submission.clientProfileId.toString());
      const review = this.deriveReviewPayload(submission.form.schemaJson, submission.answersJson);

      return {
        id: submission.id.toString(),
        formId: submission.formId.toString(),
        formTitle: submission.form.title,
        formDescription: submission.form.description,
        targetType: submission.targetType,
        status: submission.status,
        reviewPublicationMode: submission.form.reviewPublicationMode,
        reviewerDisplayMode: submission.form.reviewerDisplayMode,
        submittedAt: submission.createdAt.toISOString(),
        reviewedAt: submission.reviewedAt?.toISOString() || null,
        publishedAt: submission.publishedAt?.toISOString() || null,
        derived: submission.derivedJson as Prisma.JsonValue | null,
        client: {
          id: submission.clientProfileId.toString(),
          firstName: client?.firstName || '',
          lastName: client?.lastName || '',
          email: client?.email || '',
          displayName: `${client?.firstName || ''} ${client?.lastName || ''}`.trim() || client?.email || 'Client',
        },
        booking: submission.booking
          ? {
              id: submission.booking.id.toString(),
              status: submission.booking.status,
              serviceTitle: submission.booking.service.title,
            }
          : null,
        answers: this.formatAnswerEntries(submission.form.schemaJson, submission.answersJson),
        review,
      };
    });
  }

  async updateSubmissionStatus(tenantId: bigint, submissionId: bigint, status: string) {
    const submission = await this.prisma.universalFormSubmission.findFirst({
      where: { id: submissionId, tenantId },
      include: { form: true },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const normalizedStatus = status.toUpperCase();
    if (!['UNREAD', 'REVIEWED', 'PUBLISHED', 'HIDDEN'].includes(normalizedStatus)) {
      throw new BadRequestException('Unsupported submission status');
    }

    const updated = await this.prisma.universalFormSubmission.update({
      where: { id: submissionId },
      data: {
        status: normalizedStatus,
        reviewedAt: normalizedStatus === 'REVIEWED' ? new Date() : submission.reviewedAt,
        publishedAt: normalizedStatus === 'PUBLISHED' ? new Date() : normalizedStatus === 'HIDDEN' ? null : submission.publishedAt,
      },
      include: { form: true },
    });

    return {
      id: updated.id.toString(),
      status: updated.status,
      reviewedAt: updated.reviewedAt?.toISOString() || null,
      publishedAt: updated.publishedAt?.toISOString() || null,
      targetType: updated.targetType,
    };
  }

  async getBookingSubmissions(tenantId: bigint, bookingId: bigint) {
    const submissions = await this.prisma.universalFormSubmission.findMany({
      where: { tenantId, bookingId },
      include: {
        form: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return submissions.map((submission) => ({
      id: submission.id.toString(),
      formTitle: submission.form.title,
      formDescription: submission.form.description,
      targetType: submission.form.targetType,
      status: submission.status,
      answers: this.formatAnswerEntries(submission.form.schemaJson, submission.answersJson),
      review: this.deriveReviewPayload(submission.form.schemaJson, submission.answersJson),
      derived: submission.derivedJson as Prisma.JsonValue | null,
      submittedAt: submission.createdAt.toISOString(),
    }));
  }

  async getPublishedReviews(tenantId: bigint) {
    const submissions = await this.prisma.universalFormSubmission.findMany({
      where: {
        tenantId,
        targetType: 'REVIEW',
        status: 'PUBLISHED',
      },
      include: {
        form: true,
      },
      orderBy: { publishedAt: 'desc' },
    });

    if (submissions.length === 0) {
      return {
        averageRating: null,
        count: 0,
        reviews: [],
      };
    }

    const clientIds = Array.from(new Set(submissions.map((submission) => submission.clientProfileId.toString()))).map((id) => BigInt(id));
    const clients = clientIds.length
      ? await this.prisma.profile.findMany({
          where: { tenantId, id: { in: clientIds } },
        })
      : [];
    const clientMap = new Map(clients.map((client) => [client.id.toString(), client]));

    const reviews = submissions
      .map((submission) => {
        const review = this.deriveReviewPayload(submission.form.schemaJson, submission.answersJson);
        if (review.rating === null && !review.testimonial) return null;

        const client = clientMap.get(submission.clientProfileId.toString());
        const fullName = `${client?.firstName || ''} ${client?.lastName || ''}`.trim() || 'Anonymous';
        const displayName = submission.form.reviewerDisplayMode === 'ANONYMOUS'
          ? 'Anonymous'
          : client?.firstName
            ? `${client.firstName}${client.lastName ? ` ${client.lastName.charAt(0)}.` : ''}`
            : fullName;

        return {
          id: submission.id.toString(),
          rating: review.rating,
          testimonial: review.testimonial,
          displayName,
          publishedAt: submission.publishedAt?.toISOString() || submission.createdAt.toISOString(),
        };
      })
      .filter(Boolean) as Array<{
        id: string;
        rating: number | null;
        testimonial: string;
        displayName: string;
        publishedAt: string;
      }>;

    const ratings = reviews.map((review) => review.rating).filter((rating): rating is number => rating !== null);

    return {
      averageRating: ratings.length ? Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1)) : null,
      count: reviews.length,
      reviews,
    };
  }
}
