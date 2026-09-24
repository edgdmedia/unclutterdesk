import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BUILTIN_INSTRUMENTS } from './builtin-instruments';
import { validateDefinition, type InstrumentDefinition } from './engine';

export type InstrumentStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';

export interface StoredInstrument {
  key: string;
  version: number;
  status: InstrumentStatus;
  builtIn: boolean;
  definition: InstrumentDefinition;
  updatedAt: Date;
}

/**
 * Where instruments live. Practices only ever see PUBLISHED ones; a RETIRED
 * instrument cannot be sent again but its past results stay readable.
 */
@Injectable()
export class InstrumentService implements OnModuleInit {
  private readonly logger = new Logger(InstrumentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Inserts any built-in instrument the database does not have yet. Never
   * updates one that exists: once stored, admins own its wording and rules.
   */
  async onModuleInit() {
    try {
      const created = await this.prisma.assessmentInstrument.createMany({
        data: BUILTIN_INSTRUMENTS.map((def) => ({
          key: def.key,
          builtIn: true,
          status: 'PUBLISHED',
          definition: def as unknown as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      });
      if (created.count) this.logger.log(`Added ${created.count} built-in assessment(s) to the library`);
    } catch (err) {
      // A missing table (migration not yet run) must not stop the API starting.
      this.logger.error(`Could not seed built-in assessments: ${(err as Error).message}`);
    }
  }

  private toStored(row: {
    key: string;
    version: number;
    status: string;
    builtIn: boolean;
    definition: Prisma.JsonValue;
    updatedAt: Date;
  }): StoredInstrument {
    return { ...row, status: row.status as InstrumentStatus, definition: row.definition as unknown as InstrumentDefinition };
  }

  async published(): Promise<StoredInstrument[]> {
    const rows = await this.prisma.assessmentInstrument.findMany({ where: { status: 'PUBLISHED' }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.toStored(r));
  }

  /** Any status: results of a retired instrument still need its wording. */
  async find(key: string): Promise<StoredInstrument | null> {
    const row = await this.prisma.assessmentInstrument.findUnique({ where: { key } });
    return row ? this.toStored(row) : null;
  }

  async findMany(keys: string[]): Promise<Map<string, StoredInstrument>> {
    const rows = await this.prisma.assessmentInstrument.findMany({ where: { key: { in: [...new Set(keys)] } } });
    return new Map(rows.map((r) => [r.key, this.toStored(r)]));
  }

  // ── Platform admin ──

  async all(): Promise<StoredInstrument[]> {
    const rows = await this.prisma.assessmentInstrument.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.toStored(r));
  }

  private check(definition: unknown): InstrumentDefinition {
    const errors = validateDefinition(definition);
    if (errors.length) throw new BadRequestException({ message: 'The definition has problems.', errors });
    return definition as InstrumentDefinition;
  }

  /** New instruments start as drafts, so practices do not see them half-made. */
  async create(definition: unknown): Promise<StoredInstrument> {
    const def = this.check(definition);
    if (await this.prisma.assessmentInstrument.findUnique({ where: { key: def.key } })) {
      throw new BadRequestException(`An instrument with the key ${def.key} already exists.`);
    }
    const row = await this.prisma.assessmentInstrument.create({
      data: { key: def.key, status: 'DRAFT', definition: def as unknown as Prisma.InputJsonValue },
    });
    return this.toStored(row);
  }

  /** Replaces the definition. The key cannot change; the version goes up. */
  async update(key: string, definition: unknown): Promise<StoredInstrument> {
    const def = this.check(definition);
    if (def.key !== key) throw new BadRequestException('The key of an instrument cannot be changed.');
    const existing = await this.prisma.assessmentInstrument.findUnique({ where: { key } });
    if (!existing) throw new NotFoundException('Instrument not found');
    const row = await this.prisma.assessmentInstrument.update({
      where: { key },
      data: { definition: def as unknown as Prisma.InputJsonValue, version: { increment: 1 } },
    });
    this.logger.log(`Assessment ${key} updated to version ${row.version}`);
    return this.toStored(row);
  }

  async setStatus(key: string, status: string): Promise<StoredInstrument> {
    if (!['DRAFT', 'PUBLISHED', 'RETIRED'].includes(status)) throw new BadRequestException('Unknown status.');
    const existing = await this.prisma.assessmentInstrument.findUnique({ where: { key } });
    if (!existing) throw new NotFoundException('Instrument not found');
    const row = await this.prisma.assessmentInstrument.update({ where: { key }, data: { status } });
    return this.toStored(row);
  }
}
