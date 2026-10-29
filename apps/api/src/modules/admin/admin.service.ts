import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { chargedKobo, collectedKobo } from '../../common/revenue';
import { isPaidTier, isTier, PLAN_SELECT, planView } from '../entitlements/entitlements';
import { NotificationService } from '../notifications/notification.service';
import { complimentaryPrefix } from '../invites/complimentary-emails';

const REASONS = ['INVITE_CODE', 'MIGRATION', 'INTERNAL'] as const;
type ComplimentaryReason = (typeof REASONS)[number];

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationService,
  ) {}

  /**
   * The demo practice holds synthetic clients, bookings and a priced service.
   * Counting it here would overstate every platform figure, including revenue,
   * from the day it is provisioned — so every aggregate excludes it.
   */
  private static readonly REAL_TENANTS = { isDemo: false } as const;

  async getStats() {
    const [tenants, activeTenants, staffCount, clientCount, bookings, forms, users] =
      await Promise.all([
        this.prisma.tenant.count({ where: AdminService.REAL_TENANTS }),
        this.prisma.tenant.count({ where: { ...AdminService.REAL_TENANTS, isActive: true } }),
        this.prisma.profile.count({
          where: {
            role: { in: ['OWNER', 'ADMIN', 'RECEPTIONIST', 'THERAPIST'] },
            tenant: AdminService.REAL_TENANTS,
          },
        }),
        this.prisma.profile.count({
          where: { role: 'CLIENT', tenant: AdminService.REAL_TENANTS },
        }),
        this.prisma.consultBooking.count({ where: { tenant: AdminService.REAL_TENANTS } }),
        this.prisma.universalForm.count({ where: { tenant: AdminService.REAL_TENANTS } }),
        // A demo login is still a user row, so exclude anyone whose only
        // profile is in the demo practice.
        this.prisma.user.count({
          where: { profiles: { some: { tenant: AdminService.REAL_TENANTS } } },
        }),
      ]);

    // Was every booking row at its service's current list price — so a
    // cancelled booking nobody paid for, and every discounted one, counted at
    // full price. Only money that arrived counts, at the amount charged.
    const bookingRows = await this.prisma.consultBooking.findMany({
      where: { tenant: AdminService.REAL_TENANTS, paidAt: { not: null } },
      select: { amountKobo: true, paidAt: true, service: { select: { priceKobo: true } } },
    });
    const revenueKobo = collectedKobo(bookingRows);

    return {
      tenants,
      activeTenants,
      staffCount,
      clientCount,
      bookings,
      forms,
      users,
      revenueKobo: Number(revenueKobo),
    };
  }

  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      // The demo practice is deliberately visible here — an operator should be
      // able to find it — but it is flagged so it cannot be mistaken for a
      // paying customer.
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            profiles: { where: { role: 'CLIENT' } },
            bookings: true,
            services: true,
          },
        },
      },
    });

    const bookingRows = await this.prisma.consultBooking.findMany({
      where: { paidAt: { not: null } },
      select: {
        tenantId: true,
        amountKobo: true,
        paidAt: true,
        service: { select: { priceKobo: true } },
      },
    });
    const revenueByTenant = new Map<string, number>();
    for (const row of bookingRows) {
      const key = row.tenantId.toString();
      revenueByTenant.set(key, (revenueByTenant.get(key) ?? 0) + Number(chargedKobo(row)));
    }

    return tenants.map((t) => ({
      id: t.id.toString(),
      isDemo: t.isDemo,
      name: t.name,
      slug: t.slug,
      customDomain: t.customDomain,
      category: t.category,
      city: t.city,
      ...planView(t),
      isActive: t.isActive,
      primaryColor: t.primaryColor,
      secondaryColor: t.secondaryColor,
      createdAt: t.createdAt.toISOString(),
      clients: t._count.profiles,
      bookings: t._count.bookings,
      services: t._count.services,
      revenueKobo: revenueByTenant.get(t.id.toString()) ?? 0,
    }));
  }

  async getTenantDetail(id: bigint) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            profiles: { where: { role: 'CLIENT' } },
            bookings: true,
            services: true,
          },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const [staff, recentBookings, recentClients, bookingRows] = await Promise.all([
      this.prisma.profile.findMany({
        where: { tenantId: id, role: { in: ['OWNER', 'ADMIN', 'RECEPTIONIST', 'THERAPIST'] } },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          avatarUrl: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.consultBooking.findMany({
        where: { tenantId: id },
        include: {
          client: { select: { firstName: true, lastName: true, email: true } },
          service: true,
          availability: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.profile.findMany({
        where: { tenantId: id, role: 'CLIENT' },
        select: { id: true, email: true, firstName: true, lastName: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.consultBooking.findMany({
        where: { tenantId: id, paidAt: { not: null } },
        select: { amountKobo: true, paidAt: true, service: { select: { priceKobo: true } } },
      }),
    ]);

    const revenueKobo = collectedKobo(bookingRows);

    return {
      id: tenant.id.toString(),
      name: tenant.name,
      slug: tenant.slug,
      customDomain: tenant.customDomain,
      category: tenant.category,
      city: tenant.city,
      address: tenant.address,
      publicEmail: tenant.publicEmail,
      publicPhone: tenant.publicPhone,
      ...planView(tenant),
      isActive: tenant.isActive,
      ecosystemIntegrationEnabled: tenant.ecosystemIntegrationEnabled,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      createdAt: tenant.createdAt.toISOString(),
      clients: tenant._count.profiles,
      bookings: tenant._count.bookings,
      services: tenant._count.services,
      revenueKobo: Number(revenueKobo),
      staff: staff.map((s) => ({
        id: s.id.toString(),
        email: s.email,
        name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email,
        role: s.role,
        status: s.status,
        avatarUrl: s.avatarUrl,
      })),
      recentClients: recentClients.map((c) => ({
        id: c.id.toString(),
        email: c.email,
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email,
        status: c.status,
      })),
      recentBookings: recentBookings.map((b) => ({
        id: b.id.toString(),
        status: b.status,
        client: `${b.client.firstName || ''} ${b.client.lastName || ''}`.trim() || b.client.email,
        service: b.service?.title || 'Session',
        startsAt: b.availability?.startsAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Activation and ecosystem integration. There is no direct plan setter: a
   * plan set by hand, with no subscription or complimentary period, would
   * quietly count as FREE. Plans change through `setComplimentary` (§5.7 #10).
   */
  async updateTenant(
    id: bigint,
    dto: { isActive?: boolean; ecosystemIntegrationEnabled?: boolean; subscriptionTier?: unknown },
  ) {
    if ('subscriptionTier' in dto) {
      throw new BadRequestException('Change a plan from Complimentary plans, with a reason and an end date.');
    }
    if (dto.ecosystemIntegrationEnabled !== undefined && typeof dto.ecosystemIntegrationEnabled !== 'boolean') {
      throw new BadRequestException('ecosystemIntegrationEnabled must be true or false');
    }
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.ecosystemIntegrationEnabled !== undefined
          ? { ecosystemIntegrationEnabled: dto.ecosystemIntegrationEnabled }
          : {}),
      },
    });
    return {
      id: tenant.id.toString(),
      isActive: tenant.isActive,
      ...planView(tenant),
      ecosystemIntegrationEnabled: tenant.ecosystemIntegrationEnabled,
    };
  }

  // ── Complimentary plans (§12) ──

  /** Practices with a complimentary plan, soonest end first; INTERNAL (no end date) last. */
  async complimentaryPlans() {
    const tenants = await this.prisma.tenant.findMany({
      where: { complimentaryReason: { not: null } },
      select: { id: true, name: true, slug: true, ...PLAN_SELECT },
      orderBy: [{ complimentaryUntil: { sort: 'asc', nulls: 'last' } }],
    });
    return tenants.map((t) => ({ id: t.id.toString(), name: t.name, slug: t.slug, ...planView(t) }));
  }

  /**
   * The only way an admin changes a practice's plan: a tier with a reason
   * and an end date, or INTERNAL with no end date. Replaces any running
   * complimentary period (its queued emails are cancelled), and stops a
   * lapse in progress.
   */
  async setComplimentary(id: bigint, actorUserId: string | undefined, dto: { tier?: unknown; reason?: unknown; until?: unknown }) {
    const tier = typeof dto.tier === 'string' ? dto.tier.toUpperCase() : '';
    if (!isTier(tier) || !isPaidTier(tier)) throw new BadRequestException('Choose Starter, Pro or Clinic.');
    if (!REASONS.includes(dto.reason as ComplimentaryReason)) throw new BadRequestException('Choose a reason.');
    const reason = dto.reason as ComplimentaryReason;
    let until: Date | null = null;
    if (dto.until !== null && dto.until !== undefined && dto.until !== '') {
      until = new Date(String(dto.until));
      if (Number.isNaN(until.getTime()) || until <= new Date()) throw new BadRequestException('Choose an end date in the future.');
    }
    if (!until && reason !== 'INTERNAL') throw new BadRequestException('Only an INTERNAL plan can have no end date.');

    const before = await this.prisma.tenant.findUnique({ where: { id }, select: { id: true, ...PLAN_SELECT } });
    if (!before) throw new NotFoundException('Practice not found');
    if (before.complimentaryUntil) {
      await this.notifications?.cancelRemindersWithPrefix(complimentaryPrefix(id, before.complimentaryUntil));
    }
    const after = await this.prisma.tenant.update({
      where: { id },
      data: { subscriptionTier: tier, complimentaryReason: reason, complimentaryUntil: until, subscriptionLapsedAt: null, downgradeAt: null },
      select: { id: true, ...PLAN_SELECT },
    });
    // The audit log arrives in Phase 1 (§4.4); until then the change is logged.
    this.logger.log(`Admin ${actorUserId ?? '?'} set complimentary plan on tenant ${id}: ${JSON.stringify(planView(before))} -> ${JSON.stringify(planView(after))}`);
    return { id: id.toString(), ...planView(after) };
  }

  /** Ends a complimentary plan now: FREE, unless the practice is paying. */
  async endComplimentary(id: bigint, actorUserId: string | undefined) {
    const before = await this.prisma.tenant.findUnique({ where: { id }, select: { id: true, ...PLAN_SELECT } });
    if (!before) throw new NotFoundException('Practice not found');
    if (before.complimentaryUntil) {
      await this.notifications?.cancelRemindersWithPrefix(complimentaryPrefix(id, before.complimentaryUntil));
    }
    const paying = before.subscriptionStatus === 'active';
    const after = await this.prisma.tenant.update({
      where: { id },
      data: paying
        ? { complimentaryReason: null, complimentaryUntil: null }
        : { subscriptionTier: 'FREE', complimentaryReason: null, complimentaryUntil: null },
      select: { id: true, ...PLAN_SELECT },
    });
    this.logger.log(`Admin ${actorUserId ?? '?'} ended complimentary plan on tenant ${id}: ${JSON.stringify(planView(before))} -> ${JSON.stringify(planView(after))}`);
    return { id: id.toString(), ...planView(after) };
  }
}
