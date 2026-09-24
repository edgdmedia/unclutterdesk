import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';

export const REQUEST_TYPES = ['ASSESSMENT', 'FEATURE', 'SERVICE', 'FEEDBACK', 'OTHER'] as const;
export const REQUEST_STATUSES = ['OPEN', 'PLANNED', 'DONE', 'DECLINED'] as const;
type RequestType = (typeof REQUEST_TYPES)[number];

const TYPE_LABEL: Record<RequestType, string> = {
  ASSESSMENT: 'Assessment',
  FEATURE: 'Feature',
  SERVICE: 'Service',
  FEEDBACK: 'Feedback',
  OTHER: 'Request',
};

const STATUS_LABEL: Record<string, string> = { OPEN: 'received', PLANNED: 'planned', DONE: 'done', DECLINED: 'declined' };

/**
 * Requests from a practice to the platform: an assessment to add, a feature,
 * a service, or feedback. Like a contact form, with a status the practice can
 * follow.
 */
@Injectable()
export class RequestService {
  private readonly logger = new Logger(RequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  private shape(r: { id: bigint; type: string; subject: string; details: string | null; status: string; adminNote: string | null; createdAt: Date; updatedAt: Date }) {
    return {
      id: r.id.toString(),
      type: r.type,
      subject: r.subject,
      details: r.details,
      status: r.status,
      adminNote: r.adminNote,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async create(tenantId: bigint, profileId: bigint, dto: { type?: string; subject?: string; details?: string }) {
    const type = String(dto?.type ?? 'OTHER').toUpperCase() as RequestType;
    if (!REQUEST_TYPES.includes(type)) throw new BadRequestException('Choose what kind of request this is.');
    const subject = String(dto?.subject ?? '').trim();
    if (subject.length < 2) throw new BadRequestException('Give your request a short title.');
    const created = await this.prisma.platformRequest.create({
      data: {
        tenantId,
        requestedByProfileId: profileId,
        type,
        subject: subject.slice(0, 160),
        details: dto.details?.trim().slice(0, 5000) || null,
      },
    });
    return this.shape(created);
  }

  async forPractice(tenantId: bigint) {
    const rows = await this.prisma.platformRequest.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map((r) => this.shape(r));
  }

  // ── Platform admin ──

  async all(filter: { type?: string; status?: string }) {
    const rows = await this.prisma.platformRequest.findMany({
      where: {
        ...(filter.type && REQUEST_TYPES.includes(filter.type as RequestType) ? { type: filter.type } : {}),
        ...(filter.status && (REQUEST_STATUSES as readonly string[]).includes(filter.status) ? { status: filter.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
      include: { tenant: { select: { name: true, slug: true } } },
    });
    return rows.map((r) => ({
      ...this.shape(r),
      practice: { id: r.tenantId.toString(), name: r.tenant.name, slug: r.tenant.slug },
    }));
  }

  /** Updates the status and note, and tells whoever asked. */
  async update(id: bigint, dto: { status?: string; adminNote?: string }) {
    const existing = await this.prisma.platformRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Request not found');
    const status = dto?.status === undefined ? existing.status : String(dto.status).toUpperCase();
    if (!(REQUEST_STATUSES as readonly string[]).includes(status)) throw new BadRequestException('Unknown status.');
    const updated = await this.prisma.platformRequest.update({
      where: { id },
      data: { status, ...(dto.adminNote !== undefined ? { adminNote: dto.adminNote?.trim() || null } : {}) },
    });

    if (existing.requestedByProfileId && (status !== existing.status || updated.adminNote !== existing.adminNote)) {
      try {
        await this.notifications.notify({
          tenantId: existing.tenantId,
          profileIds: [existing.requestedByProfileId],
          type: 'requests.updated',
          title: `${TYPE_LABEL[existing.type as RequestType] ?? 'Request'} "${existing.subject}" is ${STATUS_LABEL[status]}`,
          message: updated.adminNote ?? 'Thank you for letting us know.',
          link: '/dashboard/requests',
          actionLabel: 'View requests',
        });
      } catch (err) {
        this.logger.warn(`Could not notify about request ${id}: ${(err as Error).message}`);
      }
    }
    return this.shape(updated);
  }
}
