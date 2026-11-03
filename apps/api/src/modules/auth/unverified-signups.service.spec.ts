import { describe, expect, it, vi } from 'vitest';
import { AuditService } from '../audit/audit.service';
import { UnverifiedSignupsService } from './unverified-signups.service';

/**
 * Releasing unverified owner signups (§6.8). The database is the boundary
 * here; the same logic was also run against Postgres (removal cascades,
 * handle and slug freed, flag and warn once, second run a no-op).
 */
const NOW = new Date('2026-11-10T03:00:00Z');
const user = (over: Record<string, unknown> = {}) => ({
  id: 7n,
  email: 'old@example.com',
  createdAt: new Date('2026-11-01T00:00:00Z'),
  practitionerProfile: { id: 6n, handle: 'old-handle' },
  profiles: [{ id: 4n, tenantId: 3n, email: 'old@example.com', tenant: { id: 3n, slug: 'old-handle', name: 'Old Practice' } }],
  ...over,
});

function setup({ release = [user()], warn = [] as any[], counts = {} as Record<string, number>, audits = [] as string[], stillOther = 0 } = {}) {
  const count = (name: string) => vi.fn().mockResolvedValue(counts[name] ?? 0);
  const tx: any = {
    profile: { count: vi.fn().mockResolvedValue(stillOther) },
    token: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    tenant: { delete: vi.fn().mockResolvedValue({}) },
    user: { delete: vi.fn().mockResolvedValue({}) },
    adminAuditLog: { create: vi.fn(async ({ data }: any) => data) },
  };
  const prisma: any = {
    // warn() asks first (with a lower age bound), then release().
    user: { findMany: vi.fn(async ({ where }: any) => (where.createdAt.gte ? warn : release)) },
    consultBooking: { count: count('bookings') },
    profile: { count: count('people') },
    consultService: { count: count('services') },
    consultAvailability: { count: count('availability') },
    bankSubaccount: { count: count('payouts') },
    clinicalNote: { count: count('notes') },
    universalFormSubmission: { count: count('submissions') },
    practitionerPlace: { count: count('places') },
    platformRequest: { count: count('requests') },
    adminAuditLog: {
      findFirst: vi.fn(async ({ where }: any) => (audits.includes(where.action) ? { id: 1n } : null)),
      create: vi.fn(async ({ data }: any) => data),
    },
    $transaction: vi.fn(async (fn: (t: any) => unknown) => fn(tx)),
  };
  const notifications: any = { sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  const service = new UnverifiedSignupsService(prisma, new AuditService(prisma), notifications);
  return { service, prisma, tx, notifications };
}

describe('releasing unverified signups (§6.8)', () => {
  it('asks only for owner self-signups that are unverified everywhere and older than 7 days', async () => {
    const { service, prisma } = setup({ release: [] });
    await service.run(NOW);
    const where = prisma.user.findMany.mock.calls.at(-1)[0].where;
    expect(where).toMatchObject({
      platformRole: null,
      createdAt: { lt: new Date('2026-11-03T03:00:00Z') },
      profiles: { some: { role: 'OWNER', emailVerified: false }, every: { role: 'OWNER', emailVerified: false } },
    });
  });

  it('removes the practice and account in one transaction, with an audit entry', async () => {
    const { service, tx } = setup();
    await expect(service.run(NOW)).resolves.toEqual({ warned: 0, released: 1, flagged: 0 });
    expect(tx.token.deleteMany).toHaveBeenCalledWith({ where: { userId: 7n } });
    expect(tx.tenant.delete).toHaveBeenCalledWith({ where: { id: 3n } });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 7n } });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'signup.release', targetType: 'User', targetId: '7', metaJson: expect.objectContaining({ slug: 'old-handle', handle: 'old-handle' }) }),
    });
  });

  it('keeps and flags a practice holding anything signup did not create, once', async () => {
    const first = setup({ counts: { bookings: 2, services: 1 } });
    await expect(first.service.run(NOW)).resolves.toMatchObject({ released: 0, flagged: 1 });
    expect(first.prisma.$transaction).not.toHaveBeenCalled();
    expect(first.prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'signup.flag', metaJson: expect.objectContaining({ attached: ['bookings: 2', 'services: 1'] }) }),
    });

    const again = setup({ counts: { bookings: 2 }, audits: ['signup.flag'] });
    await expect(again.service.run(NOW)).resolves.toMatchObject({ flagged: 0 });
    expect(again.prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('keeps an account that verified or joined somewhere between the check and the removal', async () => {
    const { service, tx } = setup({ stillOther: 1 });
    await expect(service.run(NOW)).resolves.toMatchObject({ released: 0 });
    expect(tx.tenant.delete).not.toHaveBeenCalled();
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it('warns once on day 5, naming the handle', async () => {
    const first = setup({ release: [], warn: [user()] });
    await expect(first.service.run(NOW)).resolves.toMatchObject({ warned: 1 });
    expect(first.notifications.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'old@example.com', type: 'auth.unverified_release_warning', message: expect.stringContaining('old-handle') }),
    );
    expect(first.prisma.adminAuditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'signup.warn' }) });

    const again = setup({ release: [], warn: [user()], audits: ['signup.warn'] });
    await expect(again.service.run(NOW)).resolves.toMatchObject({ warned: 0 });
    expect(again.notifications.sendEmail).not.toHaveBeenCalled();
  });
});
