import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { emergencyContactData, emergencyContactOf, emergencyContactText } from './emergency-contact';

/**
 * The client record's emergency contact.
 *
 * The new-client form has asked for one since launch, but the server threw it
 * away: staff typed a name and number and the client page showed an empty
 * box. These pin that it is kept, shown to clinical staff, and editable.
 */
const TENANT = 1n;

const CLIENT_ROW = {
  id: 40n,
  tenantId: TENANT,
  role: 'CLIENT',
  status: 'active',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Ola',
  phone: null,
  createdAt: new Date('2026-08-01T09:00:00Z'),
  emergencyContactName: 'Tolu Ade',
  emergencyContactRelationship: 'Sister',
  emergencyContactPhone: '+2348010000000',
  clientBookings: [],
};

function makeService(over: Record<string, any> = {}) {
  const prisma: any = {
    profile: {
      findFirst: vi.fn().mockResolvedValue(over.findFirst === undefined ? null : over.findFirst),
      create: vi.fn(async ({ data }: any) => ({ id: 41n, createdAt: new Date('2026-09-28T09:00:00Z'), ...data })),
      update: vi.fn(async ({ data }: any) => ({ ...CLIENT_ROW, ...data })),
    },
    clinicalNote: { findMany: vi.fn().mockResolvedValue([]) },
    universalFormSubmission: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { prisma, service: new TenantService(prisma, { sendEmail: vi.fn() } as any) };
}

describe('emergency contact helpers', () => {
  it('turns blanks into nulls and trims', () => {
    expect(emergencyContactData({ name: '  Tolu ', relationship: '', phone: ' 0801 ' })).toEqual({
      emergencyContactName: 'Tolu',
      emergencyContactRelationship: null,
      emergencyContactPhone: '0801',
    });
  });

  it('reads the old single "emergency" box as the name', () => {
    expect(emergencyContactData(undefined, 'Tolu 0801')).toEqual({ emergencyContactName: 'Tolu 0801' });
  });

  it('sets nothing when nothing was given', () => {
    expect(emergencyContactData(undefined)).toEqual({});
  });

  it('refuses a relationship or phone with no name', () => {
    expect(() => emergencyContactData({ phone: '0801' })).toThrow(BadRequestException);
  });

  it('shapes a stored contact, and reports none as null', () => {
    expect(emergencyContactOf(CLIENT_ROW)).toEqual({ name: 'Tolu Ade', relationship: 'Sister', phone: '+2348010000000' });
    expect(emergencyContactOf({ emergencyContactName: null, emergencyContactRelationship: 'x', emergencyContactPhone: 'y' })).toBeNull();
    expect(emergencyContactText(emergencyContactOf(CLIENT_ROW))).toBe('Tolu Ade (Sister) · +2348010000000');
  });
});

describe('creating a client', () => {
  it('keeps the emergency contact', async () => {
    const { service, prisma } = makeService();
    const created = await service.createClient(TENANT, {
      firstName: 'Ada',
      email: 'ada@example.com',
      emergencyContact: { name: 'Tolu Ade', relationship: 'Sister', phone: '+2348010000000' },
    });
    expect(prisma.profile.create.mock.calls[0][0].data).toMatchObject({
      emergencyContactName: 'Tolu Ade',
      emergencyContactRelationship: 'Sister',
      emergencyContactPhone: '+2348010000000',
    });
    expect(created.emergencyContact).toEqual({ name: 'Tolu Ade', relationship: 'Sister', phone: '+2348010000000' });
  });

  it('still accepts the old single field from older app builds', async () => {
    const { service, prisma } = makeService();
    await service.createClient(TENANT, { firstName: 'Ada', email: 'ada@example.com', emergency: 'Tolu 0801' });
    expect(prisma.profile.create.mock.calls[0][0].data.emergencyContactName).toBe('Tolu 0801');
  });
});

describe('reading a client', () => {
  it('returns the stored contact', async () => {
    const { service } = makeService({ findFirst: CLIENT_ROW });
    const client = await service.getClientById(TENANT, 40n);
    expect(client.emergencyContact).toEqual({ name: 'Tolu Ade', relationship: 'Sister', phone: '+2348010000000' });
    expect(client.emergency).toBe('Tolu Ade (Sister) · +2348010000000');
  });

  it('is not found for a missing client', async () => {
    const { service } = makeService({ findFirst: null });
    await expect(service.getClientById(TENANT, 99n)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('editing a client', () => {
  it('updates the contact on a client of this practice', async () => {
    const { service, prisma } = makeService({ findFirst: { id: 40n } });
    const res = await service.updateClient(TENANT, 40n, { emergencyContact: { name: 'Bola', relationship: 'Friend', phone: '0802' } });
    expect(prisma.profile.findFirst).toHaveBeenCalledWith({ where: { id: 40n, tenantId: TENANT, role: 'CLIENT' }, select: { id: true } });
    expect(prisma.profile.update.mock.calls[0][0]).toMatchObject({
      where: { id: 40n },
      data: { emergencyContactName: 'Bola', emergencyContactRelationship: 'Friend', emergencyContactPhone: '0802' },
    });
    expect(res.emergencyContact).toEqual({ name: 'Bola', relationship: 'Friend', phone: '0802' });
  });

  it('clears the contact when the name is emptied', async () => {
    const { service, prisma } = makeService({ findFirst: { id: 40n } });
    await service.updateClient(TENANT, 40n, { emergencyContact: { name: '', relationship: '', phone: '' } });
    expect(prisma.profile.update.mock.calls[0][0].data).toMatchObject({
      emergencyContactName: null,
      emergencyContactRelationship: null,
      emergencyContactPhone: null,
    });
  });

  it('will not touch a staff profile or another practice’s client', async () => {
    // The scoped lookup finds nothing for either, so both are "not found".
    const { service, prisma } = makeService({ findFirst: null });
    await expect(service.updateClient(TENANT, 5n, { phone: '0803' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });

  it('refuses a blank first name', async () => {
    const { service } = makeService({ findFirst: { id: 40n } });
    await expect(service.updateClient(TENANT, 40n, { firstName: '  ' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
