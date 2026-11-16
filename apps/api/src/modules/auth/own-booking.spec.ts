import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { CsrfGuard } from './csrf.guard';
import { ACCESS_COOKIE } from '../../common/auth.config';
import { allRoutes } from '../../test-support/routes';
import { OWN_BOOKING_TOKEN, hashOwnBookingToken } from '../practitioner-profile/own-booking-link';

/**
 * §6.14 "Set up your own booking in one step": the emailed link creates a FREE
 * practice for a therapist whose last place has gone (same as §6.8, minus the
 * profile) and signs them in. The database is the boundary (faked, with
 * state); the service is the real code.
 */
const RAW = 'a'.repeat(64);

function setup(over: { expiresAt?: Date; ownsActive?: boolean; takenSlugs?: string[]; profile?: boolean; consumedElsewhere?: boolean } = {}) {
  const tokens = [{ id: 't1', userId: 1n, type: OWN_BOOKING_TOKEN, tokenHash: hashOwnBookingToken(RAW), expiresAt: over.expiresAt ?? new Date(Date.now() + 86_400_000) }];
  const tenants: any[] = [{ id: 5n, slug: 'calm-clinic', name: 'Calm Clinic', isActive: true, closureRequestedAt: null }];
  for (const slug of over.takenSlugs ?? []) tenants.push({ id: 90n + BigInt(tenants.length), slug, isActive: true });
  const memberships: any[] = [
    { id: 50n, tenantId: 5n, userId: 1n, role: 'THERAPIST', type: 'therapist', status: 'inactive', email: 'folake@example.com', username: 'folake', firstName: 'Folake', lastName: 'Adeyemi', createdAt: new Date('2026-01-01') },
  ];
  if (over.ownsActive) {
    tenants.push({ id: 8n, slug: 'folake-own', name: 'Folake Adeyemi', isActive: true, closureRequestedAt: null });
    memberships.push({ id: 80n, tenantId: 8n, userId: 1n, role: 'OWNER', type: 'therapist', status: 'active', email: 'folake@example.com', username: 'folake', firstName: 'Folake', lastName: 'Adeyemi', emailVerified: true, createdAt: new Date('2026-02-01') });
  }
  const therapistRecords: any[] = [];
  const withRelations = (m: any) => m && { ...m, tenant: tenants.find((t) => t.id === m.tenantId), consultTherapistProfile: therapistRecords.find((c) => c.profileId === m.id) ?? null };

  const db: any = {
    token: {
      findFirst: vi.fn(async ({ where }: any) => {
        const t = tokens.find((x) => x.type === where.type && x.tokenHash === where.tokenHash);
        return t ? { ...t, user: { id: 1n, email: 'folake@example.com', username: 'folake', platformRole: null } } : null;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        if (over.consumedElsewhere) return { count: 0 };
        const i = tokens.findIndex((x) => x.id === where.id);
        if (i < 0) return { count: 0 };
        tokens.splice(i, 1);
        return { count: 1 };
      }),
    },
    practitionerProfile: {
      findUnique: vi.fn(async () => (over.profile === false ? null : { id: 100n, handle: 'folake', displayName: 'Folake Adeyemi' })),
    },
    tenant: {
      findUnique: vi.fn(async ({ where }: any) => tenants.find((t) => t.slug === where.slug) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const t = { id: 9n, isActive: true, closureRequestedAt: null, ...data };
        tenants.push(t);
        return t;
      }),
    },
    profile: {
      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        let rows = memberships.filter((m) => m.userId === where.userId);
        if (where.role) rows = rows.filter((m) => m.role === where.role);
        if (where.status) rows = rows.filter((m) => m.status === where.status);
        if (where.tenant) rows = rows.filter((m) => { const t = tenants.find((x) => x.id === m.tenantId); return t.isActive === where.tenant.isActive && t.closureRequestedAt === where.tenant.closureRequestedAt; });
        if (orderBy) rows = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return withRelations(rows[0] ?? null);
      }),
      findUnique: vi.fn(async ({ where }: any) => withRelations(memberships.find((m) => m.id === where.id) ?? null)),
      create: vi.fn(async ({ data }: any) => {
        const m = { id: 99n, createdAt: new Date(), ...data };
        memberships.push(m);
        return m;
      }),
    },
    consultTherapistProfile: {
      create: vi.fn(async ({ data }: any) => (therapistRecords.push(data), data)),
    },
  };
  db.$transaction = vi.fn(async (fn: any) => fn(db));
  const sessions = { startSession: vi.fn(async () => undefined) };
  const defaultForms = { ensureFor: vi.fn(async () => undefined) };
  const service = new AuthService(db, { sign: vi.fn(() => 'jwt') } as any, { sendEmail: vi.fn() } as any, sessions as any, undefined, defaultForms as any);
  return { service, db, tokens, tenants, memberships, therapistRecords, sessions, defaultForms };
}

describe('own booking in one step (§6.14)', () => {
  it('creates a FREE practice with the therapist as its owner, and signs them in', async () => {
    const w = setup();
    const out = await w.service.claimOwnBooking({ token: RAW });

    const practice = w.tenants.find((t) => t.id === 9n);
    // They asked for booking, so it starts in the full practice view, as "switch on booking" would leave it.
    expect(practice).toMatchObject({ slug: 'folake', name: 'Folake Adeyemi', subscriptionTier: 'FREE', onboardingIntent: 'PRACTICE' });
    expect(out.createdPractice).toBe(true);
    const owner = w.memberships.find((m) => m.tenantId === 9n);
    expect(owner).toMatchObject({ userId: 1n, role: 'OWNER', type: 'therapist', status: 'active', emailVerified: true, email: 'folake@example.com', firstName: 'Folake', lastName: 'Adeyemi' });
    expect(w.therapistRecords).toEqual([expect.objectContaining({ tenantId: 9n, profileId: owner.id, publicUsername: 'folake', isPublic: true })]);
    expect(w.defaultForms.ensureFor).toHaveBeenCalledWith(9n);

    expect(out.accessToken).toBe('jwt');
    expect(w.sessions.startSession).toHaveBeenCalledTimes(1);
    expect(out.profile).toMatchObject({ id: owner.id.toString() });
  });

  it('works once: the link is used up', async () => {
    const w = setup();
    await w.service.claimOwnBooking({ token: RAW });
    expect(w.tokens).toHaveLength(0);
    await expect(w.service.claimOwnBooking({ token: RAW })).rejects.toBeInstanceOf(BadRequestException);
    expect(w.tenants.filter((t) => t.id === 9n)).toHaveLength(1);
  });

  it('loses cleanly when the same link is used twice at once', async () => {
    const w = setup({ consumedElsewhere: true });
    await expect(w.service.claimOwnBooking({ token: RAW })).rejects.toBeInstanceOf(BadRequestException);
    expect(w.db.tenant.create).not.toHaveBeenCalled();
  });

  it('answers an unknown and an expired link the same way', async () => {
    const unknown = await setup().service.claimOwnBooking({ token: 'b'.repeat(64) }).catch((e) => e);
    const expired = await setup({ expiresAt: new Date(Date.now() - 1000) }).service.claimOwnBooking({ token: RAW }).catch((e) => e);
    expect(unknown).toBeInstanceOf(BadRequestException);
    expect(expired.message).toBe(unknown.message);
  });

  it('takes the next free address when the handle is taken as a practice slug', async () => {
    const w = setup({ takenSlugs: ['folake'] });
    await w.service.claimOwnBooking({ token: RAW });
    expect(w.tenants.find((t) => t.id === 9n)?.slug).toBe('folake-2');
  });

  it('signs them into the practice they already own instead of making a second one', async () => {
    const w = setup({ ownsActive: true });
    const out = await w.service.claimOwnBooking({ token: RAW });
    expect(w.db.tenant.create).not.toHaveBeenCalled();
    expect(out.profile).toMatchObject({ id: '80' });
    expect(out.createdPractice).toBe(false);
    expect(w.tokens).toHaveLength(0);
  });

  it('is a public route: the person has no session yet, the link is the credential', () => {
    const route = allRoutes().find((r) => r.target === 'POST /v1/auth/own-booking/claim');
    expect(route).toBeDefined();
    expect(route!.authenticated).toBe(false);
    // A browser still signed in elsewhere (another practice) carries a session
    // cookie but no CSRF header for this page; like an invite claim, it's exempt.
    const req = { method: 'POST', path: '/v1/auth/own-booking/claim', headers: {}, cookies: { [ACCESS_COOKIE]: 'old-session' } };
    const ctx: any = { switchToHttp: () => ({ getRequest: () => req }) };
    expect(new CsrfGuard().canActivate(ctx)).toBe(true);
  });

  it('refuses when there is no profile to book for', async () => {
    const w = setup({ profile: false });
    await expect(w.service.claimOwnBooking({ token: RAW })).rejects.toBeInstanceOf(BadRequestException);
    expect(w.db.tenant.create).not.toHaveBeenCalled();
  });
});
