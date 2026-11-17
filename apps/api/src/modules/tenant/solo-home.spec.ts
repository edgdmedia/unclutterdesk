import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { PERMISSIONS_KEY } from '../../common/permissions';

/**
 * §6.16 "What `/` shows on a practice address". The edge router asks the
 * existence probe, which answers with the resolved home page: the owner's
 * profile for a solo practice whose owner has published, the practice page
 * otherwise or when the owner opted out. The database is faked as in-memory
 * rows the queries are actually evaluated against.
 */
type Member = { profileId: bigint; tenantId: bigint; role: string; status: string; userId: bigint | null };
type Profile = { userId: bigint; handle: string; status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN' };
type Tenant = { id: bigint; slug: string; isActive: boolean; homePage: 'PROFILE' | 'PRACTICE' | null; customDomain?: string | null; customDomainStatus?: string };

function world(seed: { tenant: Tenant; members?: Member[]; profiles?: Profile[] }) {
  const tenants = [{ customDomain: null, customDomainStatus: 'PENDING', ...seed.tenant }];
  const members = seed.members ?? [];
  const profiles = seed.profiles ?? [];
  const pick = <T extends Record<string, unknown>>(row: T, select?: Record<string, unknown>) =>
    select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : row;

  const prisma: any = {
    tenant: {
      findFirst: async ({ where, select }: any) => {
        const row = tenants.find((t) =>
          where.OR.some((c: any) => (c.slug !== undefined ? t.slug === c.slug : t.customDomain === c.customDomain && t.customDomainStatus === c.customDomainStatus)),
        );
        return row ? pick(row, select) : null;
      },
      findUnique: async ({ where, select }: any) => {
        const row = tenants.find((t) => t.id === where.id);
        return row ? pick(row, select) : null;
      },
      update: async ({ where, data }: any) => {
        const row = tenants.find((t) => t.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
    // soloOwner(): therapist memberships in the practice whose profile is active.
    consultTherapistProfile: {
      findMany: async ({ where, take }: any) =>
        members
          .filter((m) => m.tenantId === where.tenantId && m.status === where.profile.status)
          .slice(0, take)
          .map((m) => ({ profile: { role: m.role, userId: m.userId } })),
    },
    // §6.2 old addresses: none in these tests.
    tenantSlugHistory: { findUnique: async () => null },
    practitionerProfile: {
      findUnique: async ({ where, select }: any) => {
        const row = profiles.find((p) => p.userId === where.userId);
        return row ? pick(row, select) : null;
      },
    },
  };
  return { service: new TenantService(prisma, {} as any), tenants };
}

const SOLO: Tenant = { id: 1n, slug: 'ada', isActive: true, homePage: null };
const OWNER: Member = { profileId: 10n, tenantId: 1n, role: 'OWNER', status: 'active', userId: 7n };
const PUBLISHED: Profile = { userId: 7n, handle: 'ada-obi', status: 'PUBLISHED' };

describe('what / shows on a practice address (§6.16)', () => {
  it("shows the owner's profile for a solo practice whose owner has published", async () => {
    const { service } = world({ tenant: SOLO, members: [OWNER], profiles: [PUBLISHED] });
    await expect(service.getPublicTenantExistence('ada.unclutterdesk.com')).resolves.toEqual({
      exists: true,
      active: true,
      homePage: 'PROFILE',
      profileHandle: 'ada-obi',
      practiceSlug: 'ada',
    });
  });

  it('answers the same for the practice custom domain', async () => {
    const { service } = world({ tenant: { ...SOLO, customDomain: 'adaobi.com', customDomainStatus: 'ACTIVE' }, members: [OWNER], profiles: [PUBLISHED] });
    await expect(service.getPublicTenantExistence('adaobi.com')).resolves.toMatchObject({ homePage: 'PROFILE', profileHandle: 'ada-obi', practiceSlug: 'ada' });
  });

  it('keeps the practice page when the owner opted out', async () => {
    const { service } = world({ tenant: { ...SOLO, homePage: 'PRACTICE' }, members: [OWNER], profiles: [PUBLISHED] });
    await expect(service.getPublicTenantExistence('ada')).resolves.toEqual({ exists: true, active: true, homePage: 'PRACTICE' });
  });

  it('shows the profile when the owner chose it explicitly', async () => {
    const { service } = world({ tenant: { ...SOLO, homePage: 'PROFILE' }, members: [OWNER], profiles: [PUBLISHED] });
    await expect(service.getPublicTenantExistence('ada')).resolves.toMatchObject({ homePage: 'PROFILE' });
  });

  it('keeps the practice page until the profile is published, and when it is hidden', async () => {
    for (const status of ['DRAFT', 'HIDDEN'] as const) {
      const { service } = world({ tenant: SOLO, members: [OWNER], profiles: [{ ...PUBLISHED, status }] });
      await expect(service.getPublicTenantExistence('ada')).resolves.toEqual({ exists: true, active: true, homePage: 'PRACTICE' });
    }
    const { service } = world({ tenant: SOLO, members: [OWNER], profiles: [] });
    await expect(service.getPublicTenantExistence('ada')).resolves.toMatchObject({ homePage: 'PRACTICE' });
  });

  it('switches to the practice page when a second therapist is active, and back when they leave', async () => {
    const colleague: Member = { profileId: 11n, tenantId: 1n, role: 'THERAPIST', status: 'active', userId: 8n };
    const team = world({ tenant: SOLO, members: [OWNER, colleague], profiles: [PUBLISHED] });
    await expect(team.service.getPublicTenantExistence('ada')).resolves.toMatchObject({ homePage: 'PRACTICE' });

    const left = world({ tenant: SOLO, members: [OWNER, { ...colleague, status: 'inactive' }], profiles: [PUBLISHED] });
    await expect(left.service.getPublicTenantExistence('ada')).resolves.toMatchObject({ homePage: 'PROFILE' });
  });

  it("doesn't count admin or reception staff: they have no therapist membership", async () => {
    // Staff without a ConsultTherapistProfile never appear in the membership query.
    const { service } = world({ tenant: SOLO, members: [OWNER], profiles: [PUBLISHED] });
    await expect(service.getPublicTenantExistence('ada')).resolves.toMatchObject({ homePage: 'PROFILE' });
  });

  it("keeps the practice page when the only therapist isn't the owner", async () => {
    const { service } = world({ tenant: SOLO, members: [{ ...OWNER, role: 'THERAPIST' }], profiles: [PUBLISHED] });
    await expect(service.getPublicTenantExistence('ada')).resolves.toMatchObject({ homePage: 'PRACTICE' });
  });

  it('keeps the practice page for a deactivated practice, so clients reach its inactive page', async () => {
    const { service } = world({ tenant: { ...SOLO, isActive: false }, members: [OWNER], profiles: [PUBLISHED] });
    await expect(service.getPublicTenantExistence('ada')).resolves.toEqual({ exists: true, active: false, homePage: 'PRACTICE' });
  });

  it('says nothing more than "missing" for an unknown practice', async () => {
    const { service } = world({ tenant: SOLO });
    await expect(service.getPublicTenantExistence('nobody')).resolves.toEqual({ exists: false, active: false });
  });
});

describe("the owner's home page setting (§6.16 opt-out)", () => {
  it('stores PROFILE or PRACTICE', async () => {
    const { service, tenants } = world({ tenant: SOLO, members: [OWNER], profiles: [PUBLISHED] });
    await expect(service.setHomePage(1n, 'PRACTICE')).resolves.toEqual({ homePage: 'PRACTICE' });
    expect(tenants[0].homePage).toBe('PRACTICE');
    await expect(service.getPublicTenantExistence('ada')).resolves.toMatchObject({ homePage: 'PRACTICE' });

    await service.setHomePage(1n, 'PROFILE');
    await expect(service.getPublicTenantExistence('ada')).resolves.toMatchObject({ homePage: 'PROFILE' });
  });

  it('refuses anything else', async () => {
    const { service, tenants } = world({ tenant: SOLO });
    for (const bad of [null, undefined, '', 'profile', 'HOME', 1, true]) {
      await expect(service.setHomePage(1n, bad)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(tenants[0].homePage).toBeNull();
  });

  it('caches the answer for 60 s at most, a miss for 30 s', async () => {
    for (const [host, expected] of [['ada', 'public, max-age=60'], ['nobody', 'public, max-age=30']] as const) {
      const { service } = world({ tenant: SOLO, members: [OWNER], profiles: [PUBLISHED] });
      const headers: Record<string, string> = {};
      const res = { setHeader: (k: string, v: string) => (headers[k] = v) } as any;
      await new TenantController(service).getPublicExistence(host, res);
      expect(headers['Cache-Control']).toBe(expected);
    }
  });

  it('is the owner\'s to change: the route needs practice.owner', () => {
    const permissions = Reflect.getMetadata(PERMISSIONS_KEY, TenantController.prototype.setHomePage);
    expect(permissions).toEqual(['practice.owner']);
  });
});
