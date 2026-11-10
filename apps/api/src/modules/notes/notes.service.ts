import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { decryptNoteFields, encryptNoteFields } from '../../common/field-encryption';
import { normaliseRichInput } from '../../common/rich-text';

/** The four SOAP sections as they are stored: formatted documents cleaned to the allowed shape (common/rich-text.ts). */
function soapSections(dto: { subjective?: string; objective?: string; assessment?: string; plan?: string }) {
  const out: { subjective?: string | null; objective?: string | null; assessment?: string | null; plan?: string | null } = {};
  for (const [field, label] of [['subjective', 'Subjective'], ['objective', 'Objective'], ['assessment', 'Assessment'], ['plan', 'Plan']] as const) {
    if (dto[field] === undefined) continue;
    try {
      out[field] = normaliseRichInput(dto[field], label);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }
  return out;
}

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

    const sections = soapSections(dto);

    if (note && note.isLocked) {
      throw new BadRequestException('This clinical note has been locked and cannot be edited');
    }

    if (note) {
      note = await this.prisma.clinicalNote.update({
        where: { id: note.id },
        data: {
          // The narrative is encrypted before it reaches the database; see
          // common/field-encryption.ts.
          ...encryptNoteFields(sections),
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
          ...encryptNoteFields(sections),
          diagnosisCode: dto.diagnosisCode,
        },
      });
    }

    const readable = decryptNoteFields(note);
    return {
      id: note.id.toString(),
      subjective: readable.subjective,
      objective: readable.objective,
      assessment: readable.assessment,
      plan: readable.plan,
      isLocked: note.isLocked,
      updatedAt: note.updatedAt.toISOString(),
    };
  }

  async getClientNotes(tenantId: bigint, clientProfileId: bigint) {
    const notes = await this.prisma.clinicalNote.findMany({
      where: { tenantId, clientProfileId },
      orderBy: { createdAt: 'desc' },
    });

    return notes.map((n) => {
      const readable = decryptNoteFields(n);
      return {
      id: n.id.toString(),
      bookingId: n.bookingId?.toString(),
      subjective: readable.subjective,
      objective: readable.objective,
      assessment: readable.assessment,
      plan: readable.plan,
      diagnosisCode: n.diagnosisCode,
      isLocked: n.isLocked,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
      };
    });
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
