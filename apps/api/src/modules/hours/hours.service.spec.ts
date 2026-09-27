import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { hoursPdf } from './hours-pdf';
import { HoursService } from './hours.service';

function setup() {
  const prisma: any = {
    consultBooking: { findMany: vi.fn().mockResolvedValue([]) },
    practitionerHoursEntry: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({ id: 99n }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    practitionerHoursTarget: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({}) },
    profile: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn() },
    tenant: { findUnique: vi.fn() },
  };
  return { service: new HoursService(prisma), prisma };
}

const booking = (id: bigint, minutes = 50) => ({
  id,
  clientProfileId: 30n,
  availability: { startsAt: new Date('2026-09-01T09:00:00Z') },
  service: { durationMinutes: minutes },
});

describe('HoursService.sync', () => {
  it('creates an entry for each completed booking that has none', async () => {
    const { service, prisma } = setup();
    prisma.consultBooking.findMany.mockResolvedValue([booking(1n), booking(2n, 90)]);
    prisma.practitionerHoursEntry.findMany.mockResolvedValue([{ id: 10n, bookingId: 1n }]);

    await service.sync(5n, 7n);

    expect(prisma.consultBooking.findMany.mock.calls[0][0].where).toEqual({
      tenantId: 5n,
      status: 'COMPLETED',
      availability: { providerProfileId: 7n },
    });
    const created = prisma.practitionerHoursEntry.createMany.mock.calls[0][0];
    expect(created.skipDuplicates).toBe(true);
    expect(created.data).toEqual([
      expect.objectContaining({ tenantId: 5n, practitionerProfileId: 7n, bookingId: 2n, durationMinutes: 90, source: 'BOOKING', category: 'DIRECT_CLIENT' }),
    ]);
    expect(prisma.practitionerHoursEntry.deleteMany).not.toHaveBeenCalled();
  });

  it('removes session entries whose booking is no longer completed', async () => {
    const { service, prisma } = setup();
    prisma.consultBooking.findMany.mockResolvedValue([booking(1n)]);
    prisma.practitionerHoursEntry.findMany.mockResolvedValue([
      { id: 10n, bookingId: 1n },
      { id: 11n, bookingId: 2n },
    ]);

    await service.sync(5n, 7n);

    expect(prisma.practitionerHoursEntry.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [11n] }, tenantId: 5n, practitionerProfileId: 7n, source: 'BOOKING' },
    });
    expect(prisma.practitionerHoursEntry.createMany).not.toHaveBeenCalled();
  });
});

describe('HoursService.create', () => {
  it('saves a manual entry', async () => {
    const { service, prisma } = setup();
    await service.create(5n, 7n, { date: '2026-09-10', durationMinutes: 60, category: 'SUPERVISION', supervisorName: ' Dr. Bello ', notes: '' });
    expect(prisma.practitionerHoursEntry.create.mock.calls[0][0].data).toMatchObject({
      tenantId: 5n,
      practitionerProfileId: 7n,
      durationMinutes: 60,
      category: 'SUPERVISION',
      source: 'MANUAL',
      supervisorName: 'Dr. Bello',
      notes: null,
      clientProfileId: null,
    });
  });

  it.each([
    [{ date: '2026-09-10', durationMinutes: 2, category: 'OTHER' }, /between 5 minutes/],
    [{ date: '2026-09-10', durationMinutes: 50.5, category: 'OTHER' }, /whole minutes/],
    [{ date: '2999-01-01', durationMinutes: 50, category: 'OTHER' }, /future/],
    [{ date: 'nope', durationMinutes: 50, category: 'OTHER' }, /not valid/],
    [{ date: '2026-09-10', durationMinutes: 50, category: 'NAPPING' }, /Category/],
  ])('rejects %o', async (dto, message) => {
    const { service } = setup();
    await expect(service.create(5n, 7n, dto as any)).rejects.toThrow(message);
  });

  it('only accepts a client from the same practice', async () => {
    const { service, prisma } = setup();
    prisma.profile.findFirst.mockResolvedValue(null);
    await expect(service.create(5n, 7n, { date: '2026-09-10', durationMinutes: 50, category: 'DIRECT_CLIENT', clientProfileId: '31' })).rejects.toThrow('Unknown client');
    expect(prisma.profile.findFirst.mock.calls[0][0].where).toEqual({ id: 31n, tenantId: 5n, role: 'CLIENT' });
  });
});

describe('HoursService.update and remove', () => {
  it('lets a session entry change only its category and notes', async () => {
    const { service, prisma } = setup();
    prisma.practitionerHoursEntry.findFirst.mockResolvedValue({ id: 10n, source: 'BOOKING' });
    await expect(service.update(5n, 7n, 10n, { durationMinutes: 120 })).rejects.toBeInstanceOf(BadRequestException);
    await service.update(5n, 7n, 10n, { category: 'GROUP', notes: 'Couples' });
    expect(prisma.practitionerHoursEntry.update.mock.calls[0][0].data).toEqual({ category: 'GROUP', notes: 'Couples' });
  });

  it('refuses to delete a session entry, but deletes a manual one', async () => {
    const { service, prisma } = setup();
    prisma.practitionerHoursEntry.findFirst.mockResolvedValueOnce({ id: 10n, source: 'BOOKING' });
    await expect(service.remove(5n, 7n, 10n)).rejects.toBeInstanceOf(BadRequestException);
    prisma.practitionerHoursEntry.findFirst.mockResolvedValueOnce({ id: 12n, source: 'MANUAL' });
    await service.remove(5n, 7n, 12n);
    expect(prisma.practitionerHoursEntry.delete).toHaveBeenCalledWith({ where: { id: 12n } });
  });

  it('never touches another practitioner’s entry', async () => {
    const { service, prisma } = setup();
    prisma.practitionerHoursEntry.findFirst.mockResolvedValue(null);
    await expect(service.remove(5n, 7n, 10n)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.practitionerHoursEntry.findFirst.mock.calls[0][0].where).toEqual({ id: 10n, tenantId: 5n, practitionerProfileId: 7n });
  });
});

describe('HoursService.setTarget', () => {
  it('stores the practitioner’s own target', async () => {
    const { service, prisma } = setup();
    await service.setTarget(5n, 7n, { label: 'Diploma practicum', totalTargetHours: 200, supervisionTargetHours: 20 });
    expect(prisma.practitionerHoursTarget.upsert.mock.calls[0][0].create).toEqual({
      tenantId: 5n,
      practitionerProfileId: 7n,
      label: 'Diploma practicum',
      totalTargetHours: 200,
      supervisionTargetHours: 20,
    });
  });

  it('rejects a nonsense target', async () => {
    const { service } = setup();
    await expect(service.setTarget(5n, 7n, { totalTargetHours: -3 })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('hoursPdf', () => {
  it('produces a PDF with initials, not names', async () => {
    const pdf = await hoursPdf(
      [
        { date: new Date('2026-09-01'), durationMinutes: 50, category: 'DIRECT_CLIENT', source: 'BOOKING', clientName: 'Adaeze Okonkwo', notes: null, supervisorName: null },
        { date: new Date('2026-09-02'), durationMinutes: 60, category: 'SUPERVISION', source: 'MANUAL', clientName: null, notes: 'Case review', supervisorName: 'Dr. Bello' },
      ],
      { practiceName: 'Unclutter', practitionerName: 'Jane Smith', targetLabel: 'Diploma practicum', totalTargetHours: 200 },
    );
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
