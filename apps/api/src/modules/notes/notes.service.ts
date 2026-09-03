import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async saveSOAPNote(tenantId: bigint, authorProfileId: bigint, dto: {
    bookingId?: string;
    clientProfileId: string;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    diagnosisCode?: string;
  }) {
    const clientProfileId = BigInt(dto.clientProfileId);
    const bookingId = dto.bookingId ? BigInt(dto.bookingId) : null;

    // ClinicalNote.clientProfileId is a plain column with no foreign key, so
    // nothing else stops a note being filed against another practice's client.
    const client = await this.prisma.profile.findFirst({
      where: { id: clientProfileId, tenantId },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException('Client not found in this practice');
    }

    // Check if an existing unlocked note exists for this booking
    let note = bookingId
      ? await this.prisma.clinicalNote.findFirst({
          where: { tenantId, bookingId },
        })
      : null;

    if (note && note.isLocked) {
      throw new BadRequestException('This clinical note has been locked and cannot be edited');
    }

    if (note) {
      note = await this.prisma.clinicalNote.update({
        where: { id: note.id },
        data: {
          subjective: dto.subjective,
          objective: dto.objective,
          assessment: dto.assessment,
          plan: dto.plan,
          diagnosisCode: dto.diagnosisCode,
        },
      });
    } else {
      note = await this.prisma.clinicalNote.create({
        data: {
          tenantId,
          bookingId,
          clientProfileId,
          authorProfileId,
          subjective: dto.subjective,
          objective: dto.objective,
          assessment: dto.assessment,
          plan: dto.plan,
          diagnosisCode: dto.diagnosisCode,
        },
      });
    }

    return {
      id: note.id.toString(),
      subjective: note.subjective,
      objective: note.objective,
      assessment: note.assessment,
      plan: note.plan,
      isLocked: note.isLocked,
      updatedAt: note.updatedAt.toISOString(),
    };
  }

  async getClientNotes(tenantId: bigint, clientProfileId: bigint) {
    const notes = await this.prisma.clinicalNote.findMany({
      where: { tenantId, clientProfileId },
      orderBy: { createdAt: 'desc' },
    });

    return notes.map((n) => ({
      id: n.id.toString(),
      bookingId: n.bookingId?.toString(),
      subjective: n.subjective,
      objective: n.objective,
      assessment: n.assessment,
      plan: n.plan,
      diagnosisCode: n.diagnosisCode,
      isLocked: n.isLocked,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }));
  }

  async lockNote(tenantId: bigint, noteId: bigint) {
    // updateMany rather than update: `update` needs a unique where clause, so
    // it cannot carry tenantId, and without it any signed-in therapist could
    // lock any clinical note on the platform by id — ids are sequential, and a
    // locked note can no longer be edited by the practice that owns it.
    const result = await this.prisma.clinicalNote.updateMany({
      where: { id: noteId, tenantId },
      data: { isLocked: true },
    });

    if (result.count === 0) {
      // Same response whether the note is missing or belongs to someone else,
      // so this cannot be used to discover which ids exist.
      throw new NotFoundException('Clinical note not found');
    }

    return { id: noteId.toString(), isLocked: true };
  }
}
