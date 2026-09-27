import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { HoursRow, HOURS_CATEGORIES, isHoursCategory, totalsOf } from './hours-format';

export interface HoursEntryInput {
  date?: string;
  durationMinutes?: number;
  category?: string;
  notes?: string | null;
  supervisorName?: string | null;
  clientProfileId?: string | null;
}

export interface HoursTargetInput {
  label?: string | null;
  totalTargetHours?: number | null;
  supervisionTargetHours?: number | null;
}

const MAX_NOTE = 1000;
const MAX_NAME = 120;

function cleanText(value: unknown, max: number): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new BadRequestException('Expected text');
  const text = value.trim();
  if (text.length > max) throw new BadRequestException(`Keep this under ${max} characters.`);
  return text || null;
}

function cleanHours(value: unknown, field: string): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 20000) {
    throw new BadRequestException(`${field} must be a whole number of hours between 0 and 20000.`);
  }
  return n;
}

/**
 * A practitioner's hours log. Entries from completed bookings are derived:
 * every read first brings them in step with the bookings (one entry per
 * completed booking, removed if the booking is no longer completed), which
 * also backfills sessions completed before the log existed. Manual entries
 * are the practitioner's own.
 */
@Injectable()
export class HoursService {
  constructor(private readonly prisma: PrismaService) {}

  /** Brings BOOKING entries in line with this practitioner's completed bookings. */
  async sync(tenantId: bigint, practitionerProfileId: bigint) {
    const completed = await this.prisma.consultBooking.findMany({
      where: { tenantId, status: 'COMPLETED', availability: { providerProfileId: practitionerProfileId } },
      select: {
        id: true,
        clientProfileId: true,
        availability: { select: { startsAt: true } },
        service: { select: { durationMinutes: true } },
      },
    });
    const existing = await this.prisma.practitionerHoursEntry.findMany({
      where: { tenantId, practitionerProfileId, source: 'BOOKING' },
      select: { id: true, bookingId: true },
    });

    const completedIds = new Set(completed.map((b) => b.id));
    const haveIds = new Set(existing.map((e) => e.bookingId).filter((id): id is bigint => id != null));

    const missing = completed.filter((b) => !haveIds.has(b.id));
    if (missing.length) {
      await this.prisma.practitionerHoursEntry.createMany({
        data: missing.map((b) => ({
          tenantId,
          practitionerProfileId,
          bookingId: b.id,
          clientProfileId: b.clientProfileId,
          date: b.availability.startsAt,
          durationMinutes: b.service.durationMinutes,
          category: 'DIRECT_CLIENT',
          source: 'BOOKING',
        })),
        skipDuplicates: true,
      });
    }

    const stale = existing.filter((e) => e.bookingId != null && !completedIds.has(e.bookingId)).map((e) => e.id);
    if (stale.length) {
      await this.prisma.practitionerHoursEntry.deleteMany({
        where: { id: { in: stale }, tenantId, practitionerProfileId, source: 'BOOKING' },
      });
    }
  }

  async list(tenantId: bigint, practitionerProfileId: bigint) {
    await this.sync(tenantId, practitionerProfileId);
    const [rows, target] = await Promise.all([
      this.rows(tenantId, practitionerProfileId),
      this.prisma.practitionerHoursTarget.findUnique({
        where: { tenantId_practitionerProfileId: { tenantId, practitionerProfileId } },
      }),
    ]);

    return {
      categories: HOURS_CATEGORIES,
      totals: totalsOf(rows),
      target: target
        ? {
            label: target.label,
            totalTargetHours: target.totalTargetHours,
            supervisionTargetHours: target.supervisionTargetHours,
          }
        : null,
      entries: rows.map((r) => ({
        id: r.id.toString(),
        date: r.date.toISOString(),
        durationMinutes: r.durationMinutes,
        category: r.category,
        source: r.source,
        bookingId: r.bookingId?.toString() ?? null,
        clientProfileId: r.clientProfileId?.toString() ?? null,
        clientName: r.clientName,
        notes: r.notes,
        supervisorName: r.supervisorName,
      })),
    };
  }

  /** Rows for display and export, newest first, with client names resolved. */
  async rows(tenantId: bigint, practitionerProfileId: bigint) {
    const entries = await this.prisma.practitionerHoursEntry.findMany({
      where: { tenantId, practitionerProfileId },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });
    const clientIds = [...new Set(entries.map((e) => e.clientProfileId).filter((id): id is bigint => id != null))];
    const clients = clientIds.length
      ? await this.prisma.profile.findMany({
          where: { id: { in: clientIds }, tenantId },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const names = new Map(clients.map((c) => [c.id, [c.firstName, c.lastName].filter(Boolean).join(' ') || null]));
    return entries.map((e) => ({ ...e, clientName: e.clientProfileId ? names.get(e.clientProfileId) ?? null : null }));
  }

  async exportRows(tenantId: bigint, practitionerProfileId: bigint): Promise<HoursRow[]> {
    await this.sync(tenantId, practitionerProfileId);
    const rows = await this.rows(tenantId, practitionerProfileId);
    // Oldest first reads naturally in a log.
    return rows.reverse().map((r) => ({
      date: r.date,
      durationMinutes: r.durationMinutes,
      category: r.category,
      source: r.source,
      clientName: r.clientName,
      notes: r.notes,
      supervisorName: r.supervisorName,
    }));
  }

  async create(tenantId: bigint, practitionerProfileId: bigint, dto: HoursEntryInput) {
    const date = this.parseDate(dto.date);
    const durationMinutes = this.parseDuration(dto.durationMinutes);
    const category = this.parseCategory(dto.category ?? 'OTHER');
    const clientProfileId = await this.parseClient(tenantId, dto.clientProfileId);

    const entry = await this.prisma.practitionerHoursEntry.create({
      data: {
        tenantId,
        practitionerProfileId,
        date,
        durationMinutes,
        category,
        source: 'MANUAL',
        clientProfileId,
        notes: cleanText(dto.notes, MAX_NOTE),
        supervisorName: cleanText(dto.supervisorName, MAX_NAME),
      },
    });
    return { id: entry.id.toString() };
  }

  /**
   * Manual entries can change anything. Session entries follow their booking,
   * so only the category, notes and supervisor can change.
   */
  async update(tenantId: bigint, practitionerProfileId: bigint, id: bigint, dto: HoursEntryInput) {
    const entry = await this.requireOwn(tenantId, practitionerProfileId, id);
    const isManual = entry.source === 'MANUAL';

    if (!isManual && (dto.date !== undefined || dto.durationMinutes !== undefined || dto.clientProfileId !== undefined)) {
      throw new BadRequestException('A session’s date, length and client come from the booking. Only its category and notes can be changed here.');
    }

    await this.prisma.practitionerHoursEntry.update({
      where: { id: entry.id },
      data: {
        ...(dto.category !== undefined ? { category: this.parseCategory(dto.category) } : {}),
        ...(dto.notes !== undefined ? { notes: cleanText(dto.notes, MAX_NOTE) } : {}),
        ...(dto.supervisorName !== undefined ? { supervisorName: cleanText(dto.supervisorName, MAX_NAME) } : {}),
        ...(isManual && dto.date !== undefined ? { date: this.parseDate(dto.date) } : {}),
        ...(isManual && dto.durationMinutes !== undefined ? { durationMinutes: this.parseDuration(dto.durationMinutes) } : {}),
        ...(isManual && dto.clientProfileId !== undefined
          ? { clientProfileId: await this.parseClient(tenantId, dto.clientProfileId) }
          : {}),
      },
    });
    return { id: entry.id.toString() };
  }

  async remove(tenantId: bigint, practitionerProfileId: bigint, id: bigint) {
    const entry = await this.requireOwn(tenantId, practitionerProfileId, id);
    if (entry.source !== 'MANUAL') {
      throw new BadRequestException('Session hours come from completed bookings. Change the booking to remove them.');
    }
    await this.prisma.practitionerHoursEntry.delete({ where: { id: entry.id } });
    return { ok: true };
  }

  async setTarget(tenantId: bigint, practitionerProfileId: bigint, dto: HoursTargetInput) {
    const data = {
      label: cleanText(dto.label, 80),
      totalTargetHours: cleanHours(dto.totalTargetHours, 'Total target'),
      supervisionTargetHours: cleanHours(dto.supervisionTargetHours, 'Supervision target'),
    };
    await this.prisma.practitionerHoursTarget.upsert({
      where: { tenantId_practitionerProfileId: { tenantId, practitionerProfileId } },
      create: { tenantId, practitionerProfileId, ...data },
      update: data,
    });
    return data;
  }

  /** Names for the PDF header. */
  async header(tenantId: bigint, practitionerProfileId: bigint) {
    const [tenant, practitioner, target] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
      this.prisma.profile.findFirst({
        where: { id: practitionerProfileId, tenantId },
        select: { firstName: true, lastName: true, email: true },
      }),
      this.prisma.practitionerHoursTarget.findUnique({
        where: { tenantId_practitionerProfileId: { tenantId, practitionerProfileId } },
      }),
    ]);
    return {
      practiceName: tenant?.name ?? 'Practice',
      practitionerName:
        [practitioner?.firstName, practitioner?.lastName].filter(Boolean).join(' ') || practitioner?.email || 'Practitioner',
      target,
    };
  }

  // ── Validation ──

  private async requireOwn(tenantId: bigint, practitionerProfileId: bigint, id: bigint) {
    const entry = await this.prisma.practitionerHoursEntry.findFirst({ where: { id, tenantId, practitionerProfileId } });
    if (!entry) throw new NotFoundException('Entry not found');
    return entry;
  }

  private parseDate(value: unknown): Date {
    if (typeof value !== 'string' || !value) throw new BadRequestException('Choose a date.');
    const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('That date is not valid.');
    if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000) throw new BadRequestException('Hours cannot be logged in the future.');
    if (date.getFullYear() < 1990) throw new BadRequestException('That date is too far back.');
    return date;
  }

  private parseDuration(value: unknown): number {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 5 || n > 720) {
      throw new BadRequestException('Duration must be between 5 minutes and 12 hours, in whole minutes.');
    }
    return n;
  }

  private parseCategory(value: unknown): string {
    if (!isHoursCategory(value)) throw new BadRequestException(`Category must be one of ${HOURS_CATEGORIES.join(', ')}.`);
    return value;
  }

  private async parseClient(tenantId: bigint, value: unknown): Promise<bigint | null> {
    if (value == null || value === '') return null;
    let id: bigint;
    try {
      id = BigInt(String(value));
    } catch {
      throw new BadRequestException('Unknown client');
    }
    const client = await this.prisma.profile.findFirst({ where: { id, tenantId, role: 'CLIENT' }, select: { id: true } });
    if (!client) throw new BadRequestException('Unknown client');
    return client.id;
  }
}
