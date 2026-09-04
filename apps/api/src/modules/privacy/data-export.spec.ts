import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataExportService } from './data-export.service';

/**
 * Subject access under the NDPA.
 *
 * Closing a practice was built and erasure was built, but nothing produced a
 * copy of what is held, so a person asking a practice "what do you have about
 * me?" had no route through the product.
 *
 * The two rules that matter most here are the ones a careless implementation
 * gets wrong: an export must never cross a tenant, and it must not hand out
 * the clinician's notes because an endpoint was called.
 */
const TENANT = 1n;
const OWNER = 5n;
const CLIENT = 40n;

function makeService(over: Record<string, any> = {}) {
  const client = {
    id: CLIENT,
    tenantId: TENANT,
    role: 'CLIENT',
    status: 'active',
    email: 'ada@example.com',
    username: 'ada',
    firstName: 'Ada',
    lastName: 'Ola',
    phone: '+2348000000000',
    gender: null,
    dateOfBirth: null,
    avatarUrl: null,
    emailVerified: true,
    createdAt: new Date('2026-08-01T09:00:00Z'),
    tenant: { name: 'Ada Therapy', slug: 'ada-therapy' },
    ...(over.client ?? {}),
  };

  const prisma: any = {
    profile: {
      findFirst: vi
        .fn()
        // First call resolves the actor, second the client.
        .mockResolvedValueOnce(over.actor === null ? null : over.actor ?? { id: OWNER, role: 'OWNER' })
        .mockResolvedValueOnce(over.client === null ? null : client),
    },
    consultBooking: { findMany: vi.fn().mockResolvedValue(over.bookings ?? []) },
    universalFormSubmission: { findMany: vi.fn().mockResolvedValue(over.submissions ?? []) },
    clinicalNote: { findMany: vi.fn().mockResolvedValue(over.notes ?? []) },
    notification: { findMany: vi.fn().mockResolvedValue(over.notifications ?? []) },
  };
  return { service: new DataExportService(prisma), prisma };
}

describe('who may export', () => {
  it('an owner may', async () => {
    const { service } = makeService();
    await expect(service.exportClientData(TENANT, OWNER, CLIENT)).resolves.toBeTruthy();
  });

  it('an admin may', async () => {
    const { service } = makeService({ actor: { id: OWNER, role: 'ADMIN' } });
    await expect(service.exportClientData(TENANT, OWNER, CLIENT)).resolves.toBeTruthy();
  });

  // Someone who books appointments has no business pulling a whole record.
  it('a receptionist may not', async () => {
    const { service } = makeService({ actor: { id: OWNER, role: 'RECEPTIONIST' } });
    await expect(service.exportClientData(TENANT, OWNER, CLIENT)).rejects.toThrow(ForbiddenException);
  });

  it('a therapist may not', async () => {
    const { service } = makeService({ actor: { id: OWNER, role: 'THERAPIST' } });
    await expect(service.exportClientData(TENANT, OWNER, CLIENT)).rejects.toThrow(ForbiddenException);
  });

  it('someone outside the practice may not', async () => {
    const { service } = makeService({ actor: null });
    await expect(service.exportClientData(TENANT, OWNER, CLIENT)).rejects.toThrow(ForbiddenException);
  });
});

describe('whose record may be exported', () => {
  // The rule erasure follows, for the same reason.
  it('the practice in the session is part of the lookup', async () => {
    const { service, prisma } = makeService();
    await service.exportClientData(TENANT, OWNER, CLIENT);
    expect(prisma.profile.findFirst.mock.calls[1][0].where).toMatchObject({
      id: CLIENT,
      tenantId: TENANT,
    });
  });

  it('a client of another practice is not found', async () => {
    const { service } = makeService({ client: null });
    await expect(service.exportClientData(TENANT, OWNER, CLIENT)).rejects.toThrow(NotFoundException);
  });

  it('every read is scoped to the practice', async () => {
    const { service, prisma } = makeService();
    await service.exportClientData(TENANT, OWNER, CLIENT);
    for (const model of ['consultBooking', 'universalFormSubmission', 'clinicalNote']) {
      expect(prisma[model].findMany.mock.calls[0][0].where, model).toMatchObject({
        tenantId: TENANT,
        clientProfileId: CLIENT,
      });
    }
  });

  it('refuses to export a colleague through the client route', async () => {
    const { service } = makeService({ client: { role: 'THERAPIST' } });
    await expect(service.exportClientData(TENANT, OWNER, CLIENT)).rejects.toThrow(BadRequestException);
  });

  // Otherwise the export is a page of tombstones presented as a record.
  it('refuses once the client has been erased', async () => {
    const { service } = makeService({ client: { status: 'erased' } });
    await expect(service.exportClientData(TENANT, OWNER, CLIENT)).rejects.toThrow(
      /has been erased/i,
    );
  });
});

describe('the clinician’s notes', () => {
  const NOTES = [
    { id: 9n, bookingId: 3n, isLocked: true, createdAt: new Date('2026-08-10T10:00:00Z'), updatedAt: null },
  ];

  it('are listed, so the person knows the record exists', async () => {
    const { service } = makeService({ notes: NOTES });
    const out = await service.exportClientData(TENANT, OWNER, CLIENT);
    expect(out.clinicalNotes.records).toHaveLength(1);
    expect(out.clinicalNotes.records[0].signedAndLocked).toBe(true);
  });

  /*
   * The heart of it. A SOAP note is the clinician's record about the person and
   * routinely carries third-party detail. Releasing it is a judgement a
   * practitioner makes, not something an endpoint decides by being called.
   */
  it('are never read out of the database in the first place', async () => {
    const { service, prisma } = makeService({ notes: NOTES });
    await service.exportClientData(TENANT, OWNER, CLIENT);
    const select = prisma.clinicalNote.findMany.mock.calls[0][0].select;
    for (const field of ['subjective', 'objective', 'assessment', 'plan', 'diagnosisCode']) {
      expect(select, `${field} must not be selected`).not.toHaveProperty(field);
    }
  });

  it('carry no narrative in the response', async () => {
    const { service } = makeService({ notes: NOTES });
    const out = await service.exportClientData(TENANT, OWNER, CLIENT);
    const serialised = JSON.stringify(out.clinicalNotes);
    for (const field of ['subjective', 'objective', 'assessment', 'plan']) {
      expect(serialised).not.toContain(field);
    }
  });

  it('say how to get them', async () => {
    const { service } = makeService({ notes: NOTES });
    const out = await service.exportClientData(TENANT, OWNER, CLIENT);
    expect(out.clinicalNotes.note).toMatch(/ask them/i);
  });
});

describe('what the person gets', () => {
  const BOOKING = {
    id: 3n,
    status: 'CONFIRMED',
    amountKobo: 450000n,
    discountCodeUsed: 'SAVE10',
    paidAt: new Date('2026-08-11T10:00:00Z'),
    paymentRef: 'booking-3-1',
    createdAt: new Date('2026-08-01T10:00:00Z'),
    notes: 'anxious about first session',
    service: { title: 'Therapy', priceKobo: 800000n, durationMinutes: 50 },
    availability: { startsAt: new Date('2026-08-12T10:00:00Z'), endsAt: null, channel: 'VIDEO' },
  };

  it('their own identifying details', async () => {
    const { service } = makeService();
    const out = await service.exportClientData(TENANT, OWNER, CLIENT);
    expect(out.about).toMatchObject({ email: 'ada@example.com', firstName: 'Ada' });
  });

  // The amount charged, not the service's price today — a discounted booking
  // must not be reported back at list price.
  it('what they were actually charged', async () => {
    const { service } = makeService({ bookings: [BOOKING] });
    const out = await service.exportClientData(TENANT, OWNER, CLIENT);
    expect(out.appointments[0].amountKobo).toBe('450000');
    expect(out.appointments[0].discountCode).toBe('SAVE10');
  });

  it('their own answers, including the assessments', async () => {
    const { service } = makeService({
      submissions: [
        {
          id: 7n,
          bookingId: 3n,
          status: 'SUBMITTED',
          answersJson: { q1: 2 },
          derivedJson: { score: 14 },
          createdAt: new Date('2026-08-09T10:00:00Z'),
          form: { title: 'PHQ-9', systemKey: 'phq9' },
        },
      ],
    });
    const out = await service.exportClientData(TENANT, OWNER, CLIENT);
    expect(out.formsYouCompleted[0]).toMatchObject({
      instrument: 'phq9',
      answers: { q1: 2 },
      scores: { score: 14 },
    });
  });

  it('is dated, so they can tell how current it is', async () => {
    const { service } = makeService();
    const out = await service.exportClientData(TENANT, OWNER, CLIENT);
    expect(new Date(out.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it('names the practice that holds it', async () => {
    const { service } = makeService();
    const out = await service.exportClientData(TENANT, OWNER, CLIENT);
    expect(out.practice).toMatchObject({ name: 'Ada Therapy', slug: 'ada-therapy' });
  });

  it('carries no password or internal user row', async () => {
    const { service } = makeService();
    const out = await service.exportClientData(TENANT, OWNER, CLIENT);
    const serialised = JSON.stringify(out);
    expect(serialised).not.toMatch(/password/i);
    expect(serialised).not.toMatch(/tokenHash/);
  });
});
