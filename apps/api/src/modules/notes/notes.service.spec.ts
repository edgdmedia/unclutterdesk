import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotesService } from './notes.service';

/**
 * Tenant isolation on clinical records.
 *
 * Every query these methods make must be scoped to the caller's tenant. A miss
 * here is a cross-tenant leak of clinical notes — the worst failure this
 * product has — and nothing in the schema prevents it: ClinicalNote references
 * tenant and booking, but clientProfileId is a plain column with no foreign
 * key, so the database will happily accept a note pointing at another
 * practice's client.
 */
const TENANT = 1n;
const OTHER_TENANT = 2n;

function makePrisma() {
  return {
    clinicalNote: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    profile: { findFirst: vi.fn().mockResolvedValue({ id: 9n }) },
  } as any;
}

const noteRow = {
  id: 5n,
  bookingId: 7n,
  subjective: 's', objective: 'o', assessment: 'a', plan: 'p',
  diagnosisCode: null, isLocked: false,
  createdAt: new Date(), updatedAt: new Date(),
};

describe('NotesService tenant isolation', () => {
  let prisma: any;
  let service: NotesService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new NotesService(prisma);
  });

  describe('getClientNotes', () => {
    it('scopes the read to the tenant', async () => {
      await service.getClientNotes(TENANT, 9n);
      expect(prisma.clinicalNote.findMany.mock.calls[0][0].where).toMatchObject({
        tenantId: TENANT,
        clientProfileId: 9n,
      });
    });

    it('never queries without a tenant filter', async () => {
      await service.getClientNotes(TENANT, 9n);
      for (const call of prisma.clinicalNote.findMany.mock.calls) {
        expect(call[0].where).toHaveProperty('tenantId');
      }
    });
  });

  describe('lockNote', () => {
    // Regression: this took tenantId and never used it, so any signed-in
    // therapist could lock any clinical note on the platform by id. Locking
    // makes a note uneditable by the practice that owns it, and ids are
    // sequential BigInts.
    it('scopes the update to the tenant', async () => {
      await service.lockNote(TENANT, 5n);
      expect(prisma.clinicalNote.updateMany).toHaveBeenCalledWith({
        where: { id: 5n, tenantId: TENANT },
        data: { isLocked: true },
      });
    });

    it('refuses a note belonging to another practice', async () => {
      prisma.clinicalNote.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.lockNote(OTHER_TENANT, 5n)).rejects.toThrow(NotFoundException);
    });

    it('does not distinguish a missing note from someone else\'s', async () => {
      prisma.clinicalNote.updateMany.mockResolvedValue({ count: 0 });
      // Identical response either way, so ids cannot be enumerated.
      const missing = await service.lockNote(TENANT, 999n).catch((e) => e.message);
      const foreign = await service.lockNote(OTHER_TENANT, 5n).catch((e) => e.message);
      expect(missing).toBe(foreign);
    });

    it('never uses an unscoped update', async () => {
      await service.lockNote(TENANT, 5n);
      expect(prisma.clinicalNote.update).not.toHaveBeenCalled();
    });
  });

  describe('saveSOAPNote', () => {
    const dto = { clientProfileId: '9', bookingId: '7', subjective: 'client reports low mood' };

    it('verifies the client belongs to the tenant before writing', async () => {
      prisma.clinicalNote.create.mockResolvedValue({ ...noteRow, id: 1n });
      await service.saveSOAPNote(TENANT, 3n, dto);

      expect(prisma.profile.findFirst.mock.calls[0][0].where).toMatchObject({
        id: 9n,
        tenantId: TENANT,
      });
    });

    // Regression: clientProfileId has no foreign key, so without this check a
    // note could be filed against another practice's client id.
    it('refuses a client from another practice', async () => {
      prisma.profile.findFirst.mockResolvedValue(null);
      await expect(service.saveSOAPNote(TENANT, 3n, dto)).rejects.toThrow(NotFoundException);
      expect(prisma.clinicalNote.create).not.toHaveBeenCalled();
      expect(prisma.clinicalNote.update).not.toHaveBeenCalled();
    });

    it('scopes the existing-note lookup to the tenant', async () => {
      prisma.clinicalNote.create.mockResolvedValue({ ...noteRow, id: 1n });
      await service.saveSOAPNote(TENANT, 3n, dto);
      expect(prisma.clinicalNote.findFirst.mock.calls[0][0].where).toMatchObject({
        tenantId: TENANT,
        bookingId: 7n,
      });
    });

    it('stamps the tenant on a newly created note', async () => {
      prisma.clinicalNote.create.mockResolvedValue({ ...noteRow, id: 1n });
      await service.saveSOAPNote(TENANT, 3n, dto);
      expect(prisma.clinicalNote.create.mock.calls[0][0].data).toMatchObject({
        tenantId: TENANT,
        clientProfileId: 9n,
        authorProfileId: 3n,
      });
    });

    it('updates only a note it already found within the tenant', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue(noteRow);
      prisma.clinicalNote.update.mockResolvedValue({ ...noteRow, subjective: 'updated' });
      await service.saveSOAPNote(TENANT, 3n, dto);
      // Safe without tenantId because the row was located by a scoped query.
      expect(prisma.clinicalNote.update.mock.calls[0][0].where).toEqual({ id: noteRow.id });
    });

    it('refuses to edit a locked note', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({ ...noteRow, isLocked: true });
      await expect(service.saveSOAPNote(TENANT, 3n, dto)).rejects.toThrow(BadRequestException);
      expect(prisma.clinicalNote.update).not.toHaveBeenCalled();
    });
  });

  // A blanket sweep, so a method added later without scoping is caught even if
  // nobody writes a test for it.
  it('every clinicalNote query carries a tenantId', async () => {
    prisma.clinicalNote.create.mockResolvedValue({ ...noteRow, id: 1n });
    await service.getClientNotes(TENANT, 9n);
    await service.lockNote(TENANT, 5n);
    await service.saveSOAPNote(TENANT, 3n, { clientProfileId: '9' });

    for (const method of ['findFirst', 'findMany', 'updateMany'] as const) {
      for (const call of prisma.clinicalNote[method].mock.calls) {
        expect(call[0].where, `${method} was called without a tenant filter`).toHaveProperty('tenantId');
      }
    }
    for (const call of prisma.clinicalNote.create.mock.calls) {
      expect(call[0].data).toHaveProperty('tenantId');
    }
  });
});
