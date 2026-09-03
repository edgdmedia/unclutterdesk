import { Injectable, BadRequestException, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCustomDomain(input?: string | null) {
    return input?.toLowerCase().trim() || null;
  }

  private validateCustomDomain(input?: string | null) {
    const value = this.normalizeCustomDomain(input);
    if (!value) return null;

    if (value.startsWith('http://') || value.startsWith('https://')) {
      throw new BadRequestException('Enter a hostname only, without http:// or https://');
    }

    if (value.includes('/')) {
      throw new BadRequestException('Custom domain must be a hostname only, without any path');
    }

    if (value.includes('?') || value.includes('#')) {
      throw new BadRequestException('Custom domain must not include query strings or fragments');
    }

    const reserved = new Set([
      'unclutterdesk.com',
      'www.unclutterdesk.com',
      'api.unclutterdesk.com',
      'app.unclutterdesk.com',
      'admin.unclutterdesk.com',
      'localhost',
    ]);

    if (reserved.has(value)) {
      throw new BadRequestException('That domain cannot be used as a practice custom domain.');
    }

    const hostnamePattern = /^(?=.{1,100}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
    if (!hostnamePattern.test(value)) {
      throw new BadRequestException('Enter a valid domain like booking.yourpractice.com');
    }

    return value;
  }

  async createTenant(dto: {
    name: string;
    slug: string;
    customDomain?: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    currency?: string;
  }) {
    const slug = dto.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    if (!slug) throw new BadRequestException('Valid practice slug is required');

    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) throw new BadRequestException('This practice slug is already taken');

    return this.prisma.tenant.create({
      data: {
        name: dto.name.trim(),
        slug,
        customDomain: this.validateCustomDomain(dto.customDomain),
        customDomainStatus: 'PENDING',
        logoUrl: dto.logoUrl,
        primaryColor: dto.primaryColor || '#0F3A53',
        secondaryColor: dto.secondaryColor || '#E3B341',
        currency: dto.currency || 'NGN',
      },
    });
  }

  async checkSlugAvailability(slug: string, tenantId?: bigint) {
    const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    if (!cleanSlug) return { available: false, reason: 'Slug is empty' };

    const existing = await this.prisma.tenant.findUnique({
      where: { slug: cleanSlug },
      select: { id: true },
    });

    if (!existing || (tenantId && existing.id === tenantId)) {
      return { available: true, slug: cleanSlug };
    }
    return { available: false, slug: cleanSlug, reason: 'Slug is already taken' };
  }

  /**
   * Existence probe for the edge router, which needs to tell "no such practice"
   * (a real 404) from "practice paused" (still served, so the app can show the
   * inactive-practice page to clients who already have sessions booked).
   *
   * Deliberately returns no tenant detail beyond those two booleans.
   */
  async getPublicTenantExistence(slugOrDomain: string) {
    const key = slugOrDomain.toLowerCase().trim();
    const tenant = await this.prisma.tenant.findFirst({
      where: { OR: [{ slug: key }, { customDomain: key }] },
      select: { isActive: true },
    });

    return { exists: Boolean(tenant), active: Boolean(tenant?.isActive) };
  }

  async getPublicTenantInfo(slugOrDomain: string) {
    const key = slugOrDomain.toLowerCase().trim();
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: key },
          { customDomain: key },
        ],
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        customDomain: true,
        customDomainStatus: true,
        logoUrl: true,
        faviconUrl: true,
        primaryColor: true,
        secondaryColor: true,
        currency: true,
        shortName: true,
        cancellationHours: true,
        welcomeTitle: true,
        welcomeMessage: true,
        publicEmail: true,
        publicPhone: true,
        city: true,
        address: true,
        category: true,
      },
    });

    if (!tenant) throw new NotFoundException('Practice not found');

    return {
      ...tenant,
      id: tenant.id.toString(),
    };
  }

  async updateTenantBrand(tenantId: bigint, dto: {
    name?: string;
    slug?: string;
    shortName?: string;
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    customDomain?: string;
    cancellationHours?: number;
    welcomeTitle?: string;
    welcomeMessage?: string;
    publicEmail?: string;
    publicPhone?: string;
    city?: string;
    address?: string;
    category?: string;
  }) {
    if (dto.customDomain) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      const tier = (tenant?.subscriptionTier || 'STARTER').toUpperCase();
      if (tier === 'STARTER') {
        throw new ForbiddenException('Custom domain requires a Pro subscription.');
      }
    }

    const data: Prisma.TenantUpdateInput = {
      ...(dto.name ? { name: dto.name.trim() } : {}),
      ...(dto.slug ? { slug: dto.slug.toLowerCase().trim() } : {}),
      ...(dto.shortName !== undefined ? { shortName: dto.shortName?.trim() || null } : {}),
      ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
      ...(dto.faviconUrl !== undefined ? { faviconUrl: dto.faviconUrl } : {}),
      ...(dto.primaryColor ? { primaryColor: dto.primaryColor } : {}),
      ...(dto.secondaryColor ? { secondaryColor: dto.secondaryColor } : {}),
      ...(dto.customDomain !== undefined
        ? {
            customDomain: this.validateCustomDomain(dto.customDomain),
            customDomainStatus: 'PENDING',
          }
        : {}),
      ...(dto.cancellationHours !== undefined ? { cancellationHours: dto.cancellationHours } : {}),
      ...(dto.welcomeTitle !== undefined ? { welcomeTitle: dto.welcomeTitle } : {}),
      ...(dto.welcomeMessage !== undefined ? { welcomeMessage: dto.welcomeMessage } : {}),
      ...(dto.publicEmail !== undefined ? { publicEmail: dto.publicEmail?.trim() || null } : {}),
      ...(dto.publicPhone !== undefined ? { publicPhone: dto.publicPhone?.trim() || null } : {}),
      ...(dto.city !== undefined ? { city: dto.city?.trim() || null } : {}),
      ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
      ...(dto.category !== undefined ? { category: dto.category?.trim() || null } : {}),
    };

    try {
      return await this.prisma.tenant.update({
        where: { id: tenantId },
        data,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('That booking handle is already taken. Try another one.');
      }
      throw err;
    }
  }

  async getTenantBrand(tenantId: bigint) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        shortName: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        customDomain: true,
        customDomainStatus: true,
        cancellationHours: true,
        welcomeTitle: true,
        welcomeMessage: true,
        publicEmail: true,
        publicPhone: true,
        city: true,
        address: true,
        category: true,
      },
    });

    if (!tenant) throw new NotFoundException('Practice tenant not found');
    return { ...tenant, id: tenant.id.toString() };
  }

  async verifyCustomDomain(tenantId: bigint) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, customDomain: true },
    });

    if (!tenant) throw new NotFoundException('Practice tenant not found');
    if (!tenant.customDomain) {
      throw new BadRequestException('No custom domain has been configured for this practice.');
    }

    const normalized = this.validateCustomDomain(tenant.customDomain);
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { customDomain: normalized, customDomainStatus: 'ACTIVE' },
      select: { id: true, customDomain: true, customDomainStatus: true },
    });

    return {
      id: updated.id.toString(),
      customDomain: updated.customDomain,
      customDomainStatus: updated.customDomainStatus,
    };
  }

  async getNotifications(tenantId: bigint) {
    const [bookings, submissions, invites] = await Promise.all([
      this.prisma.consultBooking.findMany({
        where: { tenantId },
        include: {
          client: { select: { firstName: true, lastName: true, email: true } },
          availability: true,
          service: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.universalFormSubmission.findMany({
        where: { tenantId },
        include: { form: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.consultPendingInvite.findMany({
        where: { tenantId },
        orderBy: { sentAt: 'desc' },
        take: 4,
      }),
    ]);

    const clientIds = Array.from(new Set(submissions.map((submission) => submission.clientProfileId.toString()))).map((id) => BigInt(id));
    const submissionClients = clientIds.length
      ? await this.prisma.profile.findMany({ where: { tenantId, id: { in: clientIds } } })
      : [];
    const clientMap = new Map(submissionClients.map((client) => [client.id.toString(), client]));

    const notifications = [
      ...bookings.map((booking) => ({
        id: `booking_${booking.id}`,
        category: 'Bookings',
        unread: booking.status !== 'COMPLETED',
        title: `${booking.client.firstName || ''} ${booking.client.lastName || ''}`.trim() || booking.client.email,
        body: `booked ${booking.service.title} for ${new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(booking.availability.startsAt)}.`,
        time: booking.createdAt.toISOString(),
        action: 'View booking',
      })),
      ...submissions.map((submission) => {
        const client = clientMap.get(submission.clientProfileId.toString());
        const clientName = `${client?.firstName || ''} ${client?.lastName || ''}`.trim() || client?.email || 'Client';
        const isReview = submission.targetType === 'REVIEW';
        return {
          id: `submission_${submission.id}`,
          category: isReview ? 'Messages' : 'Clinical',
          unread: submission.status === 'UNREAD',
          title: isReview ? 'New public review' : `${submission.form.title} submitted`,
          body: isReview ? `${clientName} submitted a review for the practice.` : `${clientName} submitted ${submission.form.title.toLowerCase()}.`,
          time: submission.createdAt.toISOString(),
          action: isReview ? 'Publish' : 'Review',
        };
      }),
      ...invites.map((invite) => ({
        id: `invite_${invite.id}`,
        category: 'Team',
        unread: true,
        title: invite.email,
        body: `was invited to join the practice as ${invite.role.toLowerCase()}.`,
        time: invite.sentAt.toISOString(),
        action: 'View roster',
      })),
    ]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 20);

    return notifications;
  }

  // ── Group Clinic Team & Staff Management ────────────────────────────────────

  async getClinicStaff(tenantId: bigint) {
    const staff = await this.prisma.profile.findMany({
      where: {
        tenantId,
        role: { in: ['OWNER', 'ADMIN', 'RECEPTIONIST', 'THERAPIST'] },
      },
      include: {
        consultTherapistProfile: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return staff.map((s) => ({
      id: s.id.toString(),
      email: s.email,
      firstName: s.firstName,
      lastName: s.lastName,
      role: s.role || 'THERAPIST',
      status: s.status,
      avatarUrl: s.avatarUrl,
      isTherapist: !!s.consultTherapistProfile,
      specialty: s.consultTherapistProfile?.specialty,
    }));
  }

  /**
   * What the claim page needs to render, for someone with a token and no
   * account yet. Returns the practice name, the invited address and the role —
   * and nothing else, since this is reachable without a session.
   */
  async getInviteByToken(claimToken: string) {
    const invite = await this.prisma.consultPendingInvite.findUnique({
      where: { claimToken },
      include: { tenant: { select: { name: true, slug: true } } },
    });

    if (!invite || invite.expiresAt < new Date()) {
      throw new NotFoundException('This invitation is no longer valid');
    }

    return {
      email: invite.email,
      role: invite.role,
      practiceName: invite.tenant.name,
      practiceSlug: invite.tenant.slug,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  async inviteStaffMember(tenantId: bigint, dto: { email: string; role: 'ADMIN' | 'RECEPTIONIST' | 'THERAPIST' }) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Practice tenant not found');

    const tier = (tenant.subscriptionTier || 'STARTER').toUpperCase();

    // STARTER (Free) tier: Cannot invite additional therapists or receptionists
    if (tier === 'STARTER') {
      throw new BadRequestException(
        'Staff invitations and team features require a Pro or Group Clinic subscription plan. Upgrade your plan to invite team members.',
      );
    }

    // PRO tier: Max receptionist/admin staff, secondary therapists require CLINIC tier
    if (tier === 'PRO' && dto.role === 'THERAPIST') {
      throw new BadRequestException(
        'Multi-therapist practice management requires the Group Clinic subscription plan.',
      );
    }

    const email = dto.email.toLowerCase().trim();
    // Math.random() is not cryptographic and Date.now() is predictable, so the
    // previous token could be guessed — and claiming an invite grants a role in
    // someone else's practice, with access to their clinical records.
    const claimToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await this.prisma.consultPendingInvite.upsert({
      where: { tenantId_email: { tenantId, email } },
      create: {
        tenantId,
        email,
        role: dto.role || 'THERAPIST',
        claimToken,
        expiresAt,
      },
      update: {
        role: dto.role || 'THERAPIST',
        claimToken,
        expiresAt,
      },
    });

    return {
      id: invite.id.toString(),
      email: invite.email,
      role: invite.role,
      claimToken: invite.claimToken,
      expiresAt: invite.expiresAt.toISOString(),
      inviteUrl: `${process.env.APP_URL || 'https://unclutterdesk.com'}/invite/claim?token=${claimToken}`,
    };
  }

  async updateStaffRole(
    tenantId: bigint,
    actorProfileId: bigint,
    profileId: bigint,
    role: 'OWNER' | 'ADMIN' | 'RECEPTIONIST' | 'THERAPIST',
  ) {
    const actor = await this.prisma.profile.findFirst({
      where: { id: actorProfileId, tenantId },
    });
    if (!actor || !['OWNER', 'ADMIN'].includes(actor.role)) {
      throw new ForbiddenException('Only owners and admins can change staff roles');
    }
    if (role === 'OWNER' && actor.role !== 'OWNER') {
      throw new ForbiddenException('Only the owner can assign the owner role');
    }

    const target = await this.prisma.profile.findFirst({
      where: { id: profileId, tenantId, role: { not: 'CLIENT' } },
    });
    if (!target) throw new NotFoundException('Staff member not found');

    const updated = await this.prisma.profile.update({
      where: { id: target.id },
      data: { role },
    });

    return { id: updated.id.toString(), role: updated.role };
  }

  // ── Client (Patient) Management ──────────────────────────────────────────────

  async getClients(tenantId: bigint) {
    const clients = await this.prisma.profile.findMany({
      where: {
        tenantId,
        role: 'CLIENT',
      },
      include: {
        clientBookings: {
          include: { availability: true },
          orderBy: { availability: { startsAt: 'desc' } },
          take: 1,
        },
        _count: {
          select: { clientBookings: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return clients.map((c) => {
      const nextBooking = c.clientBookings[0];
      const nextSession = nextBooking?.availability?.startsAt
        ? new Intl.DateTimeFormat('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }).format(nextBooking.availability.startsAt)
        : 'None scheduled';

      const initials = [
        (c.firstName || '').charAt(0),
        (c.lastName || '').charAt(0),
      ]
        .filter(Boolean)
        .join('')
        .toUpperCase() || '??';

      return {
        id: c.id.toString(),
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email,
        email: c.email,
        phone: c.phone || '',
        care: 'Individual Therapy',
        sessions: c._count.clientBookings.toString(),
        next: nextSession,
        status: c.status === 'active' ? 'Active' : c.status === 'inactive' ? 'Paused' : 'Pending Intake',
        initials,
        since: new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(c.createdAt),
        emergency: '',
        notes: [],
        intake: [],
      };
    });
  }

  async getClientById(tenantId: bigint, clientProfileId: bigint) {
    const client = await this.prisma.profile.findFirst({
      where: { id: clientProfileId, tenantId, role: 'CLIENT' },
      include: {
        clientBookings: {
          include: { service: true, availability: true },
          orderBy: { availability: { startsAt: 'desc' } },
        },
      },
    });

    if (!client) throw new NotFoundException('Client not found');

    const notes = await this.prisma.clinicalNote.findMany({
      where: { tenantId, clientProfileId },
      orderBy: { createdAt: 'desc' },
    });

    const intakeResponses = await this.prisma.universalFormSubmission.findMany({
      where: { tenantId, clientProfileId },
      include: { form: true },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    const initials = [
      (client.firstName || '').charAt(0),
      (client.lastName || '').charAt(0),
    ]
      .filter(Boolean)
      .join('')
      .toUpperCase() || '??';

    const intake = intakeResponses.flatMap((sub) => {
      try {
        const answers = sub.answersJson as Record<string, string>;
        return Object.entries(answers).map(([q, a]) => ({ q, a }));
      } catch {
        return [];
      }
    });

    const latestDerived = intakeResponses[0]?.derivedJson as
      | {
          instrument?: string;
          totalScore?: number;
          severity?: string;
          item9Risk?: boolean;
        }
      | null
      | undefined;

    const intakeSummary = latestDerived?.instrument === 'PHQ_9' || latestDerived?.instrument === 'GAD_7'
      ? {
          instrument: latestDerived.instrument,
          totalScore: latestDerived.totalScore ?? 0,
          severity: latestDerived.severity ?? 'Unknown',
          item9Risk: latestDerived.instrument === 'PHQ_9' ? Boolean(latestDerived.item9Risk) : false,
        }
      : null;

    return {
      id: client.id.toString(),
      name: `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.email,
      email: client.email,
      phone: client.phone || '',
      care: 'Individual Therapy',
      sessions: client.clientBookings.length.toString(),
      next:
        client.clientBookings[0]?.availability?.startsAt
          ? new Intl.DateTimeFormat('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }).format(client.clientBookings[0].availability.startsAt)
          : 'None scheduled',
      status: client.status === 'active' ? 'Active' : client.status === 'inactive' ? 'Paused' : 'Pending Intake',
      initials,
      since: new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(client.createdAt),
      emergency: '',
      notes: notes.map((n) => ({
        id: n.id.toString(),
        date: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(n.createdAt),
        time: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(n.createdAt),
        title: 'Clinical Session Note',
        status: n.isLocked ? 'COMPLETED' : 'DRAFT',
        note: n.isLocked ? 'NOTE SIGNED' : 'DRAFT',
        subjective: n.subjective || '',
        objective: n.objective || '',
        assessment: n.assessment || '',
        plan: n.plan || '',
      })),
      intake,
      intakeSummary,
    };
  }

  async createClient(tenantId: bigint, dto: {
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    care?: string;
    emergency?: string;
  }) {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.profile.findFirst({
      where: { tenantId, email },
    });
    if (existing) throw new BadRequestException('A client with this email already exists in this practice');

    const profile = await this.prisma.profile.create({
      data: {
        tenantId,
        email,
        username: email.split('@')[0] + '-' + Date.now(),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName?.trim(),
        phone: dto.phone?.trim(),
        type: 'user',
        role: 'CLIENT',
        status: 'active',
      },
    });

    const initials = [
      (profile.firstName || '').charAt(0),
      (profile.lastName || '').charAt(0),
    ]
      .filter(Boolean)
      .join('')
      .toUpperCase() || '??';

    return {
      id: profile.id.toString(),
      name: `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
      email: profile.email,
      phone: profile.phone || '',
      care: dto.care || 'Individual Therapy',
      sessions: '0',
      next: 'None scheduled',
      status: 'Active',
      initials,
      since: new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(profile.createdAt),
      emergency: dto.emergency || '',
      notes: [],
      intake: [],
    };
  }
}
