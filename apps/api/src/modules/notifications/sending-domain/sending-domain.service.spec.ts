import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResendError } from '../mail/resend.client';
import { SendingDomainService, toDnsRecords, validateLocalPart, validateSendingDomain } from './sending-domain.service';

const RECORDS = [
  { record: 'SPF', name: 'send', type: 'MX', value: 'feedback-smtp.us-east-1.amazonses.com', priority: 10, status: 'not_started' },
  { record: 'SPF', name: 'send', type: 'TXT', value: 'v=spf1 include:amazonses.com ~all', status: 'not_started' },
  { record: 'DKIM', name: 'resend._domainkey', type: 'TXT', value: 'p=MIGf...', status: 'not_started' },
  { record: 'Receiving', name: '@', type: 'MX', value: 'inbound-smtp.us-east-1.amazonaws.com', priority: 10, status: 'not_started' },
];

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    tenantId: 5n,
    domain: 'mail.drjane.ng',
    resendDomainId: 'dom_1',
    status: 'PENDING',
    records: toDnsRecords(RECORDS as any),
    fromLocalPart: 'notifications',
    verifiedAt: null,
    lastCheckedAt: null,
    ...overrides,
  };
}

function setup({ resend = true }: { resend?: boolean } = {}) {
  const client = {
    createDomain: vi.fn().mockResolvedValue({ id: 'dom_1', name: 'mail.drjane.ng', status: 'not_started', records: RECORDS }),
    getDomain: vi.fn(),
    verifyDomain: vi.fn().mockResolvedValue(undefined),
    removeDomain: vi.fn().mockResolvedValue(undefined),
  };
  const prisma: any = {
    tenantSendingDomain: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1n, verifiedAt: null, ...data })),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...row(), ...data })),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    profile: { findMany: vi.fn().mockResolvedValue([{ id: 11n }]) },
  };
  const mail: any = {
    resend: () => (resend ? client : null),
  };
  const notifications: any = { notify: vi.fn().mockResolvedValue([]) };
  return { service: new SendingDomainService(prisma, mail, notifications, { platformAddress: () => 'notifications@mail.unclutterdesk.com' } as any), prisma, client, notifications };
}

describe('validateSendingDomain', () => {
  it.each([
    ['Mail.DrJane.ng.', 'mail.drjane.ng'],
    ['unclutter.com.ng', 'unclutter.com.ng'],
  ])('accepts %s', (input, expected) => expect(validateSendingDomain(input)).toBe(expected));

  it.each(['', 'https://drjane.ng', 'hello@drjane.ng', 'drjane', 'app.unclutterdesk.com', 'unclutterdesk.com'])(
    'rejects %s',
    (input) => expect(() => validateSendingDomain(input)).toThrow(BadRequestException),
  );
});

describe('validateLocalPart', () => {
  it('accepts ordinary mailbox names', () => {
    expect(validateLocalPart('Bookings')).toBe('bookings');
    expect(validateLocalPart('care.team')).toBe('care.team');
  });
  it.each(['', 'a b', 'x@y', '.dot', 'dash-'])('rejects %s', (input) => {
    expect(() => validateLocalPart(input)).toThrow(BadRequestException);
  });
});

describe('toDnsRecords', () => {
  it('drops inbound-only records and upper-cases status', () => {
    const out = toDnsRecords(RECORDS as any);
    expect(out.map((r) => r.purpose)).toEqual(['SPF', 'SPF', 'DKIM']);
    expect(out[0]).toMatchObject({ type: 'MX', priority: 10, status: 'NOT_STARTED' });
  });
});

describe('SendingDomainService', () => {
  describe('register', () => {
    it('creates the domain on Resend and returns the records to add', async () => {
      const { service, client, prisma } = setup();
      const result: any = await service.register(5n, { domain: 'Mail.DrJane.ng', fromLocalPart: 'Bookings' });

      expect(client.createDomain).toHaveBeenCalledWith('mail.drjane.ng');
      expect(prisma.tenantSendingDomain.create.mock.calls[0][0].data).toMatchObject({
        tenantId: 5n,
        domain: 'mail.drjane.ng',
        fromLocalPart: 'bookings',
        resendDomainId: 'dom_1',
        status: 'NOT_STARTED',
      });
      expect(result.records).toHaveLength(3);
      // Not verified yet, so mail still goes from the platform address.
      expect(result.sendingFrom).toBe('notifications@mail.unclutterdesk.com');
    });

    it('refuses a second domain for the same practice', async () => {
      const { service, prisma, client } = setup();
      prisma.tenantSendingDomain.findUnique.mockResolvedValueOnce(row());
      await expect(service.register(5n, { domain: 'other.ng' })).rejects.toBeInstanceOf(ConflictException);
      expect(client.createDomain).not.toHaveBeenCalled();
    });

    it('refuses a domain another practice already uses', async () => {
      const { service, prisma } = setup();
      prisma.tenantSendingDomain.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 9n });
      await expect(service.register(5n, { domain: 'mail.drjane.ng' })).rejects.toBeInstanceOf(ConflictException);
    });

    it('says so plainly when Resend is not configured', async () => {
      const { service } = setup({ resend: false });
      await expect(service.register(5n, { domain: 'mail.drjane.ng' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('passes Resend’s own reason back for a rejected domain', async () => {
      const { service, client } = setup();
      client.createDomain.mockRejectedValueOnce(new ResendError('The domain is invalid.', 422));
      await expect(service.register(5n, { domain: 'mail.drjane.ng' })).rejects.toThrow('The domain is invalid.');
    });
  });

  describe('verify', () => {
    it('re-checks, stores the new status, and tells admins once it is verified', async () => {
      const { service, prisma, client, notifications } = setup();
      prisma.tenantSendingDomain.findUnique.mockResolvedValue(row({ status: 'PENDING' }));
      client.getDomain.mockResolvedValue({ id: 'dom_1', status: 'verified', records: RECORDS });

      const result: any = await service.verify(5n);

      expect(client.verifyDomain).toHaveBeenCalledWith('dom_1');
      const data = prisma.tenantSendingDomain.update.mock.calls[0][0].data;
      expect(data.status).toBe('VERIFIED');
      expect(data.verifiedAt).toBeInstanceOf(Date);
      expect(result.sendingFrom).toBe('notifications@mail.drjane.ng');
      expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 5n, profileIds: [11n] }));
    });

    it('does not notify when nothing changed', async () => {
      const { service, prisma, client, notifications } = setup();
      prisma.tenantSendingDomain.findUnique.mockResolvedValue(row({ status: 'PENDING' }));
      client.getDomain.mockResolvedValue({ id: 'dom_1', status: 'pending', records: RECORDS });
      await service.verify(5n);
      expect(notifications.notify).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    it('warns admins when a verified domain loses its records', async () => {
      const { service, prisma, notifications } = setup();
      prisma.tenantSendingDomain.findUnique.mockResolvedValue(row({ status: 'VERIFIED', verifiedAt: new Date() }));
      await service.handleWebhook({ type: 'domain.updated', data: { id: 'dom_1', status: 'temporary_failure', records: RECORDS as any } });
      expect(prisma.tenantSendingDomain.update.mock.calls[0][0].data.status).toBe('TEMPORARY_FAILURE');
      expect(notifications.notify.mock.calls[0][0].title).toMatch(/paused/);
    });

    it('removes the row when Resend deletes the domain', async () => {
      const { service, prisma } = setup();
      prisma.tenantSendingDomain.findUnique.mockResolvedValue(row());
      await expect(service.handleWebhook({ type: 'domain.deleted', data: { id: 'dom_1' } })).resolves.toEqual({ handled: true });
      expect(prisma.tenantSendingDomain.delete).toHaveBeenCalledWith({ where: { id: 1n } });
    });

    it('ignores domains it does not know', async () => {
      const { service, prisma } = setup();
      await expect(service.handleWebhook({ type: 'domain.updated', data: { id: 'someone-elses' } })).resolves.toEqual({ handled: false });
      expect(prisma.tenantSendingDomain.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('still removes the practice’s row when Resend already deleted the domain', async () => {
      const { service, prisma, client } = setup();
      prisma.tenantSendingDomain.findUnique.mockResolvedValue(row());
      client.removeDomain.mockRejectedValueOnce(new ResendError('Not found', 404));
      const result: any = await service.remove(5n);
      expect(prisma.tenantSendingDomain.delete).toHaveBeenCalled();
      expect(result.domain).toBeNull();
    });
  });

  describe('updateSender', () => {
    it('changes the mailbox name', async () => {
      const { service, prisma } = setup();
      prisma.tenantSendingDomain.findUnique.mockResolvedValue(row());
      await service.updateSender(5n, { fromLocalPart: 'Hello' });
      expect(prisma.tenantSendingDomain.update.mock.calls[0][0].data).toEqual({ fromLocalPart: 'hello' });
    });
  });
});

beforeEach(() => vi.clearAllMocks());
