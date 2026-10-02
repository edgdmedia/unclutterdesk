import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DEFAULT_FORMS } from './default-forms';

/**
 * BKG-06 / FRM-04: the five default forms every practice should have.
 * Creating a tenant calls this, and scripts/backfill-default-forms.mjs runs it
 * for the practices that already exist. An existing form is left exactly as it
 * is: a practice's edited wording wins.
 */
@Injectable()
export class DefaultFormsService {
  private readonly logger = new Logger(DefaultFormsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ensureFor(tenantId: bigint): Promise<void> {
    // The practice's defaults, plus the types of the forms it made itself.
    const existing = await this.prisma.universalForm.findMany({
      where: {
        tenantId,
        OR: [{ systemKey: { in: DEFAULT_FORMS.map((f) => f.systemKey) } }, { systemKey: null, isActive: true }],
      },
      select: { systemKey: true, targetType: true },
    });
    const have = new Set(existing.map((e: { systemKey: string | null }) => e.systemKey).filter(Boolean));
    const ownTypes = new Set(existing.filter((e: { systemKey: string | null }) => !e.systemKey).map((e: { targetType: string }) => e.targetType));
    for (const form of DEFAULT_FORMS) {
      if (have.has(form.systemKey)) continue;
      // A practice that already made its own review or feedback form would otherwise get two.
      if (form.skipIfPracticeHasOwn && ownTypes.has(form.targetType)) continue;
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
