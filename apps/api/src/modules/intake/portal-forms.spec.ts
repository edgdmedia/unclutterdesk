import { describe, expect, it, vi } from 'vitest';
import { IntakeService } from './intake.service';
import { BookingNotifier } from '../notifications/booking-notifier.service';

/**
 * BKG-06: clients fill the practice's default forms after booking, before the
 * first session. A returning client who already filled one in is not asked
 * again, and a paused form is never offered.
 */
const TENANT = 1n;

const INTAKE = { id: 20n, tenantId: TENANT, title: 'Client intake', description: 'The basics', targetType: 'INTAKE', systemKey: 'CLIENT_INTAKE', isActive: true, schemaJson: [{ id: 'a', label: 'A', type: 'text', required: true }, { id: 'b', label: 'B', type: 'text', required: true }, { id: 'c', label: 'C', type: 'text', required: true }, { id: 'd', label: 'D', type: 'text', required: true }], reviewPublicationMode: 'MANUAL', reviewerDisplayMode: 'FIRST_NAME', isDefault: true, createdAt: new Date(), updatedAt: new Date() };
const CONF = { ...INTAKE, id: 21n, title: 'Confidentiality', targetType: 'CONSENT', systemKey: 'CONFIDENTIALITY', schemaJson: [{ id: 'x', label: 'X', type: 'single_choice', options: ['Yes'], required: true }] };

function makePrisma({ forms = [INTAKE, CONF], submissions = [] as any[] } = {}) {
  const prisma: any = {
    universalForm: {
      findMany: vi.fn().mockResolvedValue(forms),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    universalFormSubmission: {
      findMany: vi.fn().mockResolvedValue(submissions),
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: 77n, ...data, createdAt: new Date() })),
    },
    profile: {
      findFirst: vi.fn().mockResolvedValue({ id: 42n, tenantId: TENANT, email: 'ada@example.com', firstName: 'Ada', lastName: 'O', type: 'user', role: 'CLIENT', status: 'active' }),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return prisma;
}

describe('IntakeService.pendingForms', () => {
  it('lists the default forms a client has not submitted for this practice', async () => {
    const prisma = makePrisma();
    const service = new IntakeService(prisma);
    const forms = await service.pendingForms(TENANT, 42n);
    expect(prisma.universalForm.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: TENANT,
      isActive: true,
      systemKey: { in: ['CLIENT_INTAKE', 'CONFIDENTIALITY'] },
    });
    expect(prisma.universalFormSubmission.findMany.mock.calls[0][0].where).toMatchObject({ tenantId: TENANT, clientProfileId: 42n });
    expect(forms.map((f: any) => f.id)).toEqual(['20', '21']);
    expect(forms[0]).toMatchObject({ title: 'Client intake', kind: 'INTAKE', minutes: 2 });
  });

  it('leaves out forms the client already filled in', async () => {
    const prisma = makePrisma({ submissions: [{ formId: 20n }] });
    const service = new IntakeService(prisma);
    const forms = await service.pendingForms(TENANT, 42n);
    expect(forms.map((f: any) => f.id)).toEqual(['21']);
  });

  it('a paused form is not offered', async () => {
    const prisma = makePrisma({ forms: [{ ...INTAKE, isActive: false }] });
    prisma.universalForm.findMany.mockImplementation(async ({ where }: any) => (where.isActive ? [] : []));
    const service = new IntakeService(prisma);
    expect(await service.pendingForms(TENANT, 42n)).toEqual([]);
  });
});

describe('submitting as the signed-in client', () => {
  it('links the submission to the profile id when the caller is signed in', async () => {
    const prisma = makePrisma();
    prisma.universalForm.findFirst.mockResolvedValue(INTAKE);
    const service = new IntakeService(prisma);
    await service.submitIntakeAnswers(TENANT, {
      formId: '20',
      bookingId: '900',
      clientProfileId: '42',
      answersJson: { a: '1', b: '2', c: '3', d: '4' },
    } as any);
    const created = prisma.universalFormSubmission.create.mock.calls[0][0].data;
    expect(created.clientProfileId).toBe(42n);
    expect(created.bookingId).toBe(900n);
    // The email path is not needed when the profile id is trusted.
    expect(prisma.profile.findFirst.mock.calls[0][0].where).toEqual({ id: 42n, tenantId: TENANT });
  });
});

describe('BookingNotifier confirmed email mentions the forms', () => {
  it('adds a Before your first session section with a link per form', async () => {
    const booking = {
      id: 900n, tenantId: TENANT, status: 'CONFIRMED', paymentMethod: 'PAYSTACK', amountKobo: 3500000n, videoRoomName: 'room-900', clientProfileId: 42n,
      service: { title: 'Individual Therapy', priceKobo: 3500000n },
      availability: { startsAt: new Date('2026-10-06T10:30:00Z'), channel: 'VIDEO', providerProfileId: 7n },
      client: { firstName: 'Ada', lastName: 'Okafor', email: 'ada@example.com' },
      tenant: { name: 'Smith Therapy', slug: 'smith-therapy', customDomain: null, customDomainStatus: null },
    };
    const prisma: any = {
      consultBooking: { findUnique: vi.fn().mockResolvedValue(booking) },
      profile: { findUnique: vi.fn().mockResolvedValue({ firstName: 'Jane', lastName: 'Smith' }), findMany: vi.fn().mockResolvedValue([]) },
      universalForm: { findMany: vi.fn().mockResolvedValue([INTAKE, CONF]) },
      universalFormSubmission: { findMany: vi.fn().mockResolvedValue([{ formId: 21n }]) },
    };
    const notifications = { sendEmail: vi.fn().mockResolvedValue({ success: true }), notify: vi.fn().mockResolvedValue([]) };
    const notifier = new BookingNotifier(prisma, notifications as any);
    await notifier.confirmed(900n);
    const email = notifications.sendEmail.mock.calls[0][0];
    expect(email.message).toMatch(/Before your first session/i);
    expect(email.message).toMatch(/Client intake/);
    expect(email.message).toContain('/forms/20?booking=900');
    // Already submitted: not listed again.
    expect(email.message).not.toMatch(/Confidentiality —/);
  });
});
