import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DEFAULT_FORMS } from './default-forms';

/**
 * BKG-06: the two default forms every practice should have. Creating a tenant
 * calls this, and a script backfills the practices that already exist. An
 * existing form is left exactly as it is — a practice's edited wording wins.
 */
@Injectable()
export class DefaultFormsService {
  private readonly logger = new Logger(DefaultFormsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ensureFor(tenantId: bigint): Promise<void> {
    const existing = await this.prisma.universalForm.findMany({
      where: { tenantId, systemKey: { in: DEFAULT_FORMS.map((f) => f.systemKey) } },
      select: { systemKey: true },
    });
    const have = new Set(existing.map((e: { systemKey: string | null }) => e.systemKey));
    for (const form of DEFAULT_FORMS) {
      if (have.has(form.systemKey)) continue;
      await this.prisma.universalForm
        .create({
          data: {
            tenantId,
            title: form.title,
            description: form.description,
            targetType: form.targetType,
            systemKey: form.systemKey,
            schemaJson: form.schemaJson as object,
            isDefault: true,
          },
        })
        .catch((err) => this.logger.warn(`Could not create ${form.systemKey} for tenant ${tenantId}: ${(err as Error).message}`));
    }
  }
}
