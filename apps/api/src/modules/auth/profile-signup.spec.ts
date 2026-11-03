import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

/**
 * Profile-first signup (§6.8). The database is the boundary (faked); the
 * service, handle rules and password rules are the real code.
 */
function setup(over: { tenants?: string[]; handles?: string[]; oldHandles?: string[]; users?: string[]; templates?: string[] } = {}) {
  const tenants = new Set(over.tenants ?? []);
  const handles = new Set(over.handles ?? []);
  const oldHandles = new Set(over.oldHandles ?? []);
  const users = new Set(over.users ?? []);
  const templates = new Set(over.templates ?? ['private-practice-counsellor']);
  const tx: any = {
    user: { create: vi.fn(async ({ data }: any) => ({ id: 7n, ...data })) },
    tenant: { create: vi.fn(async ({ data }: any) => ({ id: 3n, ...data })) },
    profile: { create: vi.fn(async ({ data }: any) => ({ id: 4n, ...data })) },
    consultTherapistProfile: { create: vi.fn(async ({ data }: any) => ({ id: 5n, ...data })) },
    practitionerProfile: { create: vi.fn(async ({ data }: any) => ({ id: 6n, ...data })) },
  };
  const prisma: any = {
    user: { findUnique: vi.fn(async ({ where }: any) => (users.has(where.email ?? where.username) ? { id: 1n } : null)) },
    tenant: { findUnique: vi.fn(async ({ where }: any) => (tenants.has(where.slug) ? { id: 1n } : null)) },
    practitionerProfile: { findUnique: vi.fn(async ({ where }: any) => (handles.has(where.handle) ? { id: 1n } : null)) },
    practitionerHandleHistory: { findUnique: vi.fn(async ({ where }: any) => (oldHandles.has(where.handle) ? { handle: where.handle } : null)) },
    profileTemplate: {
      findFirst: vi.fn(async ({ where }: any) => (templates.has(where.key) ? { key: where.key } : null)),
      findMany: vi.fn().mockResolvedValue([]),
    },
    token: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(async (fn: (t: any) => unknown) => fn(tx)),
  };
  const notifications = { sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  const defaultForms = { ensureFor: vi.fn().mockResolvedValue(undefined) };
  const service = new AuthService(prisma, { sign: vi.fn() } as any, notifications as any, {} as any, undefined, defaultForms as any);
  return { service, prisma, tx, notifications, defaultForms };
}

const VALID = {
  firstName: 'Folake',
  lastName: 'Adeyemi',
  email: 'Folake@Example.com ',
  password: 'Str0ng!pass',
  handle: 'Folake',
  kind: 'PSYCHOLOGIST',
  templateKey: 'private-practice-counsellor',
};

describe('profile-first signup (§6.8)', () => {
  it('creates the account, a PROFILE-first Free practice and a DRAFT profile in one transaction, then sends the code', async () => {
    const { service, prisma, tx, notifications, defaultForms } = setup();
    const out = await service.registerProfile(VALID);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.create.mock.calls[0][0].data).toMatchObject({ email: 'folake@example.com', username: 'folake' });
    expect(tx.user.create.mock.calls[0][0].data.password).not.toBe(VALID.password);
    expect(tx.tenant.create.mock.calls[0][0].data).toMatchObject({ slug: 'folake', subscriptionTier: 'FREE', onboardingIntent: 'PROFILE', name: 'Folake Adeyemi' });
    expect(tx.profile.create.mock.calls[0][0].data).toMatchObject({ tenantId: 3n, userId: 7n, role: 'OWNER', type: 'therapist', emailVerified: false });
    expect(tx.consultTherapistProfile.create.mock.calls[0][0].data).toMatchObject({ tenantId: 3n, profileId: 4n });
    expect(tx.practitionerProfile.create.mock.calls[0][0].data).toEqual({
      userId: 7n, handle: 'folake', kind: 'PSYCHOLOGIST', displayName: 'Folake Adeyemi', templateKey: 'private-practice-counsellor', status: 'DRAFT',
    });
    expect(defaultForms.ensureFor).toHaveBeenCalledWith(3n);
    expect(notifications.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'folake@example.com', type: 'auth.email_verification', code: expect.stringMatching(/^\d{6}$/) }));
    expect(out).toMatchObject({ verification_required: true, email_sent: true, handle: 'folake' });
  });

  it('gives the practice a suffixed slug when the handle is taken or reserved as a slug', async () => {
    const { service, tx } = setup({ tenants: ['folake', 'folake-2'] });
    await service.registerProfile(VALID);
    expect(tx.tenant.create.mock.calls[0][0].data.slug).toBe('folake-3');
  });

  it('refuses a handle held now or in the past, or reserved, before creating anything', async () => {
    for (const s of [setup({ handles: ['folake'] }), setup({ oldHandles: ['folake'] })]) {
      await expect(s.service.registerProfile(VALID)).rejects.toBeInstanceOf(BadRequestException);
      expect(s.prisma.$transaction).not.toHaveBeenCalled();
    }
    const { service } = setup();
    await expect(service.registerProfile({ ...VALID, handle: 'admin' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.registerProfile({ ...VALID, handle: 'a' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies the same email and password rules as /register', async () => {
    const { service, prisma } = setup({ users: ['folake@example.com'] });
    await expect(service.registerProfile(VALID)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.registerProfile({ ...VALID, password: 'short' })).rejects.toThrow(/at least 8/);
    await expect(service.registerProfile({ ...VALID, password: 'alllowercase1!' })).rejects.toThrow(/uppercase/);
    await expect(service.registerProfile({ ...VALID, email: 'not-an-email' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('needs a name and a known kind; the template is optional but must exist', async () => {
    const { service, tx } = setup();
    await expect(service.registerProfile({ ...VALID, lastName: ' ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.registerProfile({ ...VALID, kind: 'WIZARD' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.registerProfile({ ...VALID, templateKey: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
    await service.registerProfile({ ...VALID, templateKey: undefined });
    expect(tx.practitionerProfile.create.mock.calls[0][0].data.templateKey).toBeNull();
  });

  it('turns a race on a unique field into a conflict, and keeps the signup when the email fails', async () => {
    const raced = setup();
    raced.prisma.$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' }));
    await expect(raced.service.registerProfile(VALID)).rejects.toBeInstanceOf(ConflictException);

    const quiet = setup();
    quiet.notifications.sendEmail.mockRejectedValue(new Error('provider down'));
    await expect(quiet.service.registerProfile(VALID)).resolves.toMatchObject({ email_sent: false });
  });

  it('answers the live handle check without saying who holds a handle', async () => {
    const { service } = setup({ handles: ['taken-one'] });
    await expect(service.handleCheck('Taken-One')).resolves.toEqual({ handle: 'taken-one', available: false, message: expect.any(String) });
    await expect(service.handleCheck('free-one')).resolves.toEqual({ handle: 'free-one', available: true });
  });
});
