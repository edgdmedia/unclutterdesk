import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger, Optional } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { DiscountService } from '../discount/discount.service';
import { BillingService } from '../billing/billing.service';
import { PaystackService } from '../billing/paystack.service';
import { CalendarService } from '../calendar/calendar.service';
import { changePercent, chargedKobo, revenueByMonth, startOfMonth } from '../../common/revenue';
import { tenantWebOrigin } from '../../common/origins';
import { decryptNoteFields } from '../../common/field-encryption';
import { cleanImageUrl } from '../tenant/tenant.service';
import { holdExpiry, ManualPaymentService, transferReference } from './manual-payment.service';
import { listPrice, type Format } from './formats';
import { BookingNotifier } from '../notifications/booking-notifier.service';
import { BookingPaymentSettler } from '../billing/booking-payment-settler.service';
import { onlineHoldExpiry } from './online-hold';
import { assertWithinMonthlyLimit } from './booking-limits';

/** A Paystack checkout: the page to send the payer to, and the code its pop-up opens with. */
type StartedPayment = { url: string; accessCode: string };

@Injectable()
export class ConsultService {
  private readonly logger = new Logger(ConsultService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly discountService: DiscountService,
    private readonly billing: BillingService,
    private readonly paystack: PaystackService,
    private readonly calendar: CalendarService,
    private readonly manualPayments: ManualPaymentService,
    @Optional() private readonly notifier?: BookingNotifier,
    @Optional() private readonly settler?: BookingPaymentSettler,
  ) { }

  async getPublicTherapists(tenantId: bigint) {
    const practitioners = await this.prisma.consultTherapistProfile.findMany({
      where: {
        tenantId,
        isPublic: true,
        profile: { status: 'active' },
      },
      include: {
        profile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
    });

    return practitioners.map((p) => ({
      profileId: p.profileId.toString(),
      firstName: p.profile.firstName,
      lastName: p.profile.lastName,
      email: p.profile.email,
      avatarUrl: p.profile.avatarUrl || p.profile.avatarUrl,
      publicUsername: p.publicUsername,
      specialty: p.specialty,
      credentials: p.credentials,
      yearsExperience: p.yearsExperience,
      welcomeMessage: p.welcomeMessage,
      modalities: p.modalities,
      languages: p.languages,
      isPublic: p.isPublic,
      status: p.profile.status,
    }));
  }

  async getTherapistProfile(tenantId: bigint, profileId: bigint) {
    const profile = await this.prisma.consultTherapistProfile.findUnique({
      where: { tenantId_profileId: { tenantId, profileId } },
      include: { profile: true },
    });

    if (!profile) throw new NotFoundException('Therapist profile not found');

    return {
      profileId: profile.profileId.toString(),
      firstName: profile.profile.firstName,
      lastName: profile.profile.lastName,
      email: profile.profile.email,
      phone: profile.profile.phone,
      avatarUrl: profile.profile.avatarUrl,
      publicUsername: profile.publicUsername,
      bookingEmail: profile.bookingEmail,
      notificationEmail: profile.notificationEmail,
      specialty: profile.specialty,
      credentials: profile.credentials,
      yearsExperience: profile.yearsExperience,
      welcomeMessage: profile.welcomeMessage,
      modalities: profile.modalities,
      languages: profile.languages,
      isPublic: profile.isPublic,
      acceptsGeneralBooking: profile.acceptsGeneralBooking,
      videoProvider: profile.videoProvider,
      status: profile.profile.status,
    };
  }

  async updateTherapistProfile(tenantId: bigint, profileId: bigint, dto: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    publicUsername?: string;
    bookingEmail?: string;
    notificationEmail?: string;
    welcomeMessage?: string;
    specialty?: string;
    credentials?: string;
    yearsExperience?: number;
    modalities?: string[];
    languages?: string[];
    isPublic?: boolean;
    acceptsGeneralBooking?: boolean;
    videoProvider?: string;
  }) {
    if (dto.firstName !== undefined || dto.lastName !== undefined || dto.phone !== undefined) {
      await this.prisma.profile.update({
        where: { id: profileId },
        data: {
          ...(dto.firstName !== undefined ? { firstName: dto.firstName?.trim() || null } : {}),
          ...(dto.lastName !== undefined ? { lastName: dto.lastName?.trim() || null } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        },
      });
    }

    return this.prisma.consultTherapistProfile.update({
      where: { tenantId_profileId: { tenantId, profileId } },
      data: {
        ...(dto.publicUsername ? { publicUsername: dto.publicUsername.trim() } : {}),
        ...(dto.bookingEmail ? { bookingEmail: dto.bookingEmail.trim() } : {}),
        ...(dto.notificationEmail ? { notificationEmail: dto.notificationEmail.trim() } : {}),
        ...(dto.welcomeMessage !== undefined ? { welcomeMessage: dto.welcomeMessage } : {}),
        ...(dto.specialty !== undefined ? { specialty: dto.specialty } : {}),
        ...(dto.credentials !== undefined ? { credentials: dto.credentials } : {}),
        ...(dto.yearsExperience !== undefined ? { yearsExperience: dto.yearsExperience } : {}),
        ...(dto.modalities ? { modalities: dto.modalities } : {}),
        ...(dto.languages ? { languages: dto.languages } : {}),
        ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
        ...(dto.acceptsGeneralBooking !== undefined ? { acceptsGeneralBooking: dto.acceptsGeneralBooking } : {}),
        ...(dto.videoProvider ? { videoProvider: dto.videoProvider } : {}),
      },
    });
  }

  async uploadTherapistAvatar(tenantId: bigint, profileId: bigint, avatarUrl: string) {
    // Same rules as the logo, in photo's words: a shrunken data URL, an https
    // image, or nothing at all to clear it.
    const cleaned = cleanImageUrl(avatarUrl, 'photo');

    // profileId comes from the caller's own token, so this was not reachable
    // across tenants — but scoping it here enforces the invariant in the query
    // rather than relying on every future caller passing the right thing.
    const result = await this.prisma.profile.updateMany({
      where: { id: profileId, tenantId },
      data: { avatarUrl: cleaned },
    });

    if (result.count === 0) {
      throw new NotFoundException('Profile not found in this practice');
    }

    return { success: true, avatarUrl: cleaned };
  }

  async adminUpdateTherapistStatus(
    tenantId: bigint,
    actorProfileId: bigint,
    profileId: bigint,
    status: 'active' | 'inactive',
  ) {
    // The route carried only JwtAuthGuard, so any signed-in account — including
    // a client — could reach this. Deactivating a practitioner takes them out
    // of service, so it is an owner/admin action.
    const actor = await this.prisma.profile.findFirst({
      where: { id: actorProfileId, tenantId },
      select: { role: true },
    });
    if (!actor || !['OWNER', 'ADMIN'].includes(actor.role)) {
      throw new ForbiddenException('Only a practice owner or admin can change practitioner status');
    }

    // Previously `update({ where: { id: profileId } })` — tenantId was accepted
    // and never used, so any profile on the platform could be deactivated by
    // id. updateMany is used because `update` requires a unique where clause
    // and so cannot carry a tenant filter.
    const result = await this.prisma.profile.updateMany({
      where: { id: profileId, tenantId },
      data: { status },
    });

    if (result.count === 0) {
      // Identical whether the profile is absent or belongs to another practice.
      throw new NotFoundException('Practitioner not found in this practice');
    }
    const updated = { id: profileId, status };

    // If status is inactive, also set isPublic to false
    if (status === 'inactive') {
      await this.prisma.consultTherapistProfile.updateMany({
        where: { tenantId, profileId },
        data: { isPublic: false },
      });
    }

    return { profileId: updated.id.toString(), status: updated.status };
  }

  // ── Services & Scheduling ──────────────────────────────────────────────────

  async getPublicServices(tenantId: bigint) {
    const services = await this.prisma.consultService.findMany({
      where: { tenantId, isActive: true },
      include: { formats: true },
      orderBy: { durationMinutes: 'asc' },
    });

    return services
      .map((s) => ({
        id: s.id.toString(),
        title: s.title,
        description: s.description,
        durationMinutes: s.durationMinutes,
        priceKobo: s.priceKobo.toString(),
        isActive: s.isActive,
        formats: ((s as any).formats ?? []).filter((f: any) => f.isActive).map((f: any) => this.formatView(f)),
      }))
      // A service with no active format is not on offer, whatever its own
      // isActive says (rule 8).
      .filter((s) => s.formats.length > 0);
  }

  private formatView(f: { format: string; priceKobo: bigint; isActive: boolean }) {
    return { format: f.format, priceKobo: f.priceKobo.toString(), isActive: f.isActive };
  }

  /** Validates the formats a page sends: [{ format, priceKobo, isActive? }]. */
  private formatFields(raw: unknown): Array<{ format: Format; priceKobo: bigint; isActive: boolean }> | null {
    if (raw === undefined) return null;
    if (!Array.isArray(raw) || raw.length === 0) throw new BadRequestException('Offer this service online, in person, or both.');
    return raw.map((f: any) => {
      const format = (['ONLINE', 'IN_PERSON'] as const).find((x) => x === String(f?.format ?? '').toUpperCase());
      if (!format) throw new BadRequestException('Formats are online or in person.');
      const priceRaw = String(f?.priceKobo ?? '0').trim();
      if (!/^\d+$/.test(priceRaw)) throw new BadRequestException('Price must be a whole, non-negative amount.');
      return { format, priceKobo: BigInt(priceRaw), isActive: f?.isActive !== false };
    });
  }

  private async writeFormats(serviceId: bigint, formats: Array<{ format: Format; priceKobo: bigint; isActive: boolean }>) {
    for (const f of formats) {
      await this.prisma.consultServiceFormat.upsert({
        where: { serviceId_format: { serviceId, format: f.format } },
        update: { priceKobo: f.priceKobo, isActive: f.isActive },
        create: { serviceId, format: f.format, priceKobo: f.priceKobo, isActive: f.isActive },
      });
    }
  }

  /**
   * Checks a service's editable fields. Every field is optional so the same
   * rules serve create (which then insists on a title) and partial updates.
   */
  private serviceFields(dto: {
    title?: string;
    description?: string | null;
    durationMinutes?: number | string;
    priceKobo?: number | string;
    isActive?: boolean;
  }) {
    const data: {
      title?: string;
      description?: string | null;
      durationMinutes?: number;
      priceKobo?: bigint;
      isActive?: boolean;
    } = {};

    if (dto.title !== undefined) {
      const title = String(dto.title ?? '').trim();
      if (!title) throw new BadRequestException('Give the service a name.');
      if (title.length > 120) throw new BadRequestException('Keep the service name under 120 characters.');
      data.title = title;
    }
    if (dto.description !== undefined) {
      data.description = dto.description ? String(dto.description).trim().slice(0, 1000) : null;
    }
    if (dto.durationMinutes !== undefined) {
      const minutes = Number(dto.durationMinutes);
      if (!Number.isInteger(minutes) || minutes < 10 || minutes > 480) {
        throw new BadRequestException('Session length must be between 10 and 480 minutes.');
      }
      data.durationMinutes = minutes;
    }
    if (dto.priceKobo !== undefined) {
      const raw = String(dto.priceKobo ?? '0').trim();
      if (!/^\d+$/.test(raw)) throw new BadRequestException('Price must be a whole, non-negative amount.');
      data.priceKobo = BigInt(raw);
    }
    if (dto.isActive !== undefined) data.isActive = Boolean(dto.isActive);
    return data;
  }

  private serviceView(s: {
    id: bigint;
    title: string;
    description: string | null;
    durationMinutes: number;
    priceKobo: bigint;
    isActive: boolean;
    formats?: Array<{ format: string; priceKobo: bigint; isActive: boolean }>;
  }) {
    return {
      id: s.id.toString(),
      title: s.title,
      description: s.description,
      durationMinutes: s.durationMinutes,
      priceKobo: s.priceKobo.toString(),
      isActive: s.isActive,
      formats: (s.formats ?? []).map((f) => this.formatView(f)),
    };
  }

  async createService(tenantId: bigint, dto: {
    title: string;
    description?: string;
    durationMinutes?: number;
    priceKobo?: number | string;
    formats?: unknown;
  }) {
    const fields = this.serviceFields({ ...dto, title: dto?.title ?? '' });
    const formats = this.formatFields(dto.formats) ?? [{ format: 'ONLINE' as Format, priceKobo: fields.priceKobo ?? 0n, isActive: true }];
    if (!formats.some((f) => f.isActive)) throw new BadRequestException('Offer this service online, in person, or both.');
    const price = listPrice(formats) ?? 0n;
    const service = await this.prisma.consultService.create({
      data: {
        tenantId,
        title: fields.title!,
        description: fields.description ?? undefined,
        durationMinutes: fields.durationMinutes ?? 50,
        priceKobo: price,
        isActive: true,
      },
    });
    await this.writeFormats(service.id, formats);
    return this.serviceView({ ...service, priceKobo: price, formats });
  }

  /** Every service the practice has, retired ones included, for its settings page. */
  async listServices(tenantId: bigint) {
    const services = await this.prisma.consultService.findMany({
      where: { tenantId },
      include: { formats: true },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
    return services.map((s) => this.serviceView(s));
  }

  /**
   * Edits a service in place. Services are retired with isActive rather than
   * deleted: past bookings point at them, and their price is part of the
   * record of what a client paid for.
   */
  async updateService(
    tenantId: bigint,
    serviceId: bigint,
    dto: { title?: string; description?: string | null; durationMinutes?: number; priceKobo?: number | string; isActive?: boolean },
  ) {
    const existing = await this.prisma.consultService.findFirst({ where: { id: serviceId, tenantId } });
    if (!existing) throw new NotFoundException('That service could not be found.');

    const fields = this.serviceFields(dto ?? {});
    const incoming = this.formatFields((dto as any)?.formats);
    let rows: Array<{ format: Format; priceKobo: bigint; isActive: boolean }> = incoming ?? [];
    if (!incoming && fields.priceKobo !== undefined) {
      // A legacy price-only edit reprices the online row, keeping its state.
      const current = await this.prisma.consultServiceFormat.findMany({ where: { serviceId: existing.id } });
      const online = current.find((f: any) => f.format === 'ONLINE');
      rows = [{ format: 'ONLINE', priceKobo: fields.priceKobo, isActive: online ? (online as any).isActive : true }];
    }
    if (rows.length) await this.writeFormats(existing.id, rows);
    if (rows.length) {
      const all = await this.prisma.consultServiceFormat.findMany({ where: { serviceId: existing.id } });
      const price = listPrice(all);
      if (price === null) throw new BadRequestException('Offer this service online, in person, or both.');
      fields.priceKobo = price;
    }

    const updated = await this.prisma.consultService.update({
      where: { id: existing.id },
      data: { ...fields, updatedAt: new Date() },
    });
    const formats = await this.prisma.consultServiceFormat.findMany({ where: { serviceId: existing.id } });
    return this.serviceView({ ...updated, formats });
  }

  async getPublicAvailability(tenantId: bigint, providerProfileId?: bigint, serviceId?: bigint) {
    const now = new Date();
    const slots = await this.prisma.consultAvailability.findMany({
      where: {
        tenantId,
        isActive: true,
        startsAt: { gte: now },
        ...(providerProfileId ? { providerProfileId } : {}),
        ...(serviceId ? { OR: [{ serviceId }, { serviceId: null }] } : {}),
      },
      include: {
        therapist: {
          include: {
            profile: {
              select: { firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    // A time shorter than the chosen service would only be refused at booking.
    const service = serviceId
      ? await this.prisma.consultService.findFirst({ where: { id: serviceId, tenantId }, select: { durationMinutes: true } })
      : null;
    const longEnough = (s: { startsAt: Date; endsAt: Date }) =>
      !service || (s.endsAt.getTime() - s.startsAt.getTime()) / 60_000 >= service.durationMinutes;

    return slots.filter(longEnough).map((s) => ({
      id: s.id.toString(),
      serviceId: s.serviceId?.toString() || null,
      providerProfileId: s.providerProfileId.toString(),
      therapistName: `${s.therapist.profile.firstName || ''} ${s.therapist.profile.lastName || ''}`.trim() || 'Therapist',
      therapistTitle: [s.therapist.credentials, s.therapist.specialty].filter(Boolean).join(' · ') || null,
      avatarUrl: s.therapist.profile.avatarUrl,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      channel: s.channel,
    }));
  }

  async createAvailabilitySlot(tenantId: bigint, providerProfileId: bigint, dto: {
    startsAt: string;
    endsAt: string;
    serviceId?: string;
    channel?: string;
  }) {
    const slot = await this.prisma.consultAvailability.create({
      data: {
        tenantId,
        providerProfileId,
        serviceId: dto.serviceId ? BigInt(dto.serviceId) : null,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        channel: dto.channel || 'VIDEO',
        isActive: true,
      },
    });

    return {
      id: slot.id.toString(),
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
    };
  }

  async getTherapistAvailability(tenantId: bigint, providerProfileId: bigint) {
    const now = new Date();
    const slots = await this.prisma.consultAvailability.findMany({
      where: {
        tenantId,
        providerProfileId,
        startsAt: { gte: now },
      },
      orderBy: { startsAt: 'asc' },
    });

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });

    return {
      cancellationHours: tenant?.cancellationHours ?? 24,
      slots: slots.map((slot) => ({
        id: slot.id.toString(),
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        isActive: slot.isActive,
      })),
    };
  }

  /**
   * Removes an availability slot the practitioner owns.
   *
   * There was no endpoint for this at all: the schedule's delete button only
   * filtered the row out of local React state, so the slot reappeared on
   * refresh. Scoped to the tenant and the owning practitioner, and refuses a
   * slot that already has a booking — cancelling an appointment is a different
   * operation with a client on the other end of it.
   */
  async deleteAvailabilitySlot(tenantId: bigint, providerProfileId: bigint, slotId: bigint) {
    const booked = await this.prisma.consultBooking.count({
      where: { tenantId, availabilityId: slotId, status: { not: 'CANCELLED' } },
    });

    if (booked > 0) {
      throw new BadRequestException(
        'This slot has a booking. Cancel the session instead of deleting the slot.',
      );
    }

    const deleted = await this.prisma.consultAvailability.deleteMany({
      where: { id: slotId, tenantId, providerProfileId },
    });

    if (deleted.count === 0) {
      // Same answer whether it never existed or belongs to another practitioner.
      throw new NotFoundException('Availability slot not found');
    }

    return { id: slotId.toString(), deleted: true };
  }

  async replaceTherapistAvailability(tenantId: bigint, providerProfileId: bigint, dto: {
    days: Array<{ day: number; enabled: boolean; windows: Array<{ start: string; end: string }> }>;
    sessionLengthMinutes: number;
    gapMinutes: number;
    cancellationHours?: number;
  }) {
    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 28);

    await this.prisma.consultAvailability.deleteMany({
      where: {
        tenantId,
        providerProfileId,
        startsAt: { gte: now },
        bookings: { none: {} },
      },
    });

    // Sessions still going ahead. A regenerated slot must never sit on one:
    // booked slots survive the delete above, and without this a fresh open
    // slot at the same time let a second client book the same hour.
    const taken = (
      await this.prisma.consultBooking.findMany({
        where: { tenantId, status: { not: 'CANCELLED' }, availability: { providerProfileId, endsAt: { gt: now } } },
        select: { availability: { select: { startsAt: true, endsAt: true } } },
      })
    ).map((b) => b.availability);
    const isTaken = (start: Date, end: Date) => taken.some((t) => t.startsAt < end && t.endsAt > start);

    const slotData: Array<{ tenantId: bigint; providerProfileId: bigint; serviceId: bigint | null; startsAt: Date; endsAt: Date; channel: string; isActive: boolean }> = [];

    for (let cursor = new Date(now); cursor <= horizon; cursor.setDate(cursor.getDate() + 1)) {
      const jsDay = cursor.getDay();
      const weekday = jsDay === 0 ? 6 : jsDay - 1;
      const rule = dto.days.find((day) => day.day === weekday && day.enabled);
      if (!rule) continue;

      for (const window of rule.windows) {
        const [startHour, startMinute] = window.start.split(':').map(Number);
        const [endHour, endMinute] = window.end.split(':').map(Number);
        const windowStart = new Date(cursor);
        windowStart.setHours(startHour, startMinute, 0, 0);
        const windowEnd = new Date(cursor);
        windowEnd.setHours(endHour, endMinute, 0, 0);

        for (let slotStart = new Date(windowStart); slotStart < windowEnd;) {
          const slotEnd = new Date(slotStart.getTime() + dto.sessionLengthMinutes * 60_000);
          if (slotEnd > windowEnd) break;
          if (slotEnd > now && !isTaken(slotStart, slotEnd)) {
            slotData.push({
              tenantId,
              providerProfileId,
              // Open to any service. Pinning every slot to the oldest service
              // left services added later with no bookable times at all.
              serviceId: null,
              startsAt: new Date(slotStart),
              endsAt: slotEnd,
              channel: 'VIDEO',
              isActive: true,
            });
          }
          slotStart = new Date(slotEnd.getTime() + dto.gapMinutes * 60_000);
        }
      }
    }

    if (slotData.length > 0) {
      await this.prisma.consultAvailability.createMany({ data: slotData });
    }

    if (dto.cancellationHours !== undefined) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { cancellationHours: dto.cancellationHours },
      });
    }

    return this.getTherapistAvailability(tenantId, providerProfileId);
  }

  async createBooking(tenantId: bigint, clientProfileId: bigint, dto: {
    serviceId: string;
    availabilityId: string;
    notes?: string;
    discountCode?: string;
    /** "MANUAL" to pay by bank transfer, where the practice offers it. */
    paymentMethod?: string;
  }) {
    // Checked before anything else: a malformed id used to crash deep inside
    // the transaction and reach the client as a 500.
    if (!/^\d+$/.test(String(dto?.serviceId ?? '')) || !/^\d+$/.test(String(dto?.availabilityId ?? ''))) {
      throw new BadRequestException('Choose a service and a time.');
    }
    // Who books comes from the session, never from the form: name and email
    // are the profile's own.
    const client = await this.prisma.profile.findFirst({
      where: { id: clientProfileId, tenantId, role: 'CLIENT', status: 'active' },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true },
    });
    if (!client) throw new ForbiddenException('Sign in as the client to book a session.');
    const serviceId = BigInt(dto.serviceId);
    const availabilityId = BigInt(dto.availabilityId);

    // Verify availability slot exists and is active
    const slot = await this.prisma.consultAvailability.findFirst({
      where: { id: availabilityId, tenantId, isActive: true },
      include: {
        therapist: {
          include: { profile: true },
        },
        service: true,
        tenant: true,
      },
    });

    if (!slot) {
      throw new BadRequestException('The selected time slot is no longer available');
    }

    // A slot either names its service or is open to any of the practice's
    // active ones, in which case the client's choice is checked here, never
    // trusted: its price is what gets charged.
    const service =
      slot.service ??
      (await this.prisma.consultService.findFirst({ where: { id: serviceId, tenantId, isActive: true } }));
    if (!service) {
      throw new BadRequestException('That service is no longer offered. Please choose another.');
    }
    if (
      !slot.service &&
      service.durationMinutes > (slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000
    ) {
      throw new BadRequestException('That time is too short for this service. Please pick another time.');
    }

    // Validate discount code if provided
    let discountResult = null;
    if (dto.discountCode) {
      discountResult = await this.discountService.validateDiscount(tenantId, dto.discountCode, service.priceKobo);
    }

    await assertWithinMonthlyLimit(this.prisma, tenantId, slot.tenant.subscriptionTier);

    // Checked here, never trusted from the page: the practice must offer it now.
    const wantsManual = String(dto.paymentMethod ?? '').toUpperCase() === 'MANUAL';
    const manualDetails = wantsManual ? await this.manualPayments.available(tenantId) : null;
    if (wantsManual && !manualDetails) {
      throw new BadRequestException('This practice is not taking bank transfers right now. Please pay online.');
    }

    // Atomic transaction: claim the slot, find or create the client profile,
    // create the booking, and record discount usage.
    const result: {
      bookingId: string; icalToken: string; status: string; serviceTitle: string; startsAt: string; endsAt: string;
      therapistName: string; videoRoomLink: string | null; paymentUrl: string | null; accessCode: string | null;
      reference: string | null; holdExpiresAt: string | null; manualPayment: unknown; forms?: unknown[];
    } = await this.prisma.$transaction(async (tx) => {
      // Claim the slot first, with the condition in the UPDATE itself.
      //
      // The availability check above runs outside this transaction, so two
      // concurrent requests can both pass it. The deactivation used to be an
      // unconditional `update`, which meant both would succeed and the slot
      // would carry two bookings and two payment attempts. Here the predicate
      // is evaluated while the row is locked: the second transaction blocks
      // until the first commits, then matches nothing and loses the race
      // cleanly, rolling back before any booking is written.
      const claimed = await tx.consultAvailability.updateMany({
        where: { id: slot.id, tenantId, isActive: true },
        data: { isActive: false },
      });

      if (claimed.count === 0) {
        throw new BadRequestException('The selected time slot is no longer available');
      }

      const bookingId = Date.now();
      const { roomName: videoRoomName, roomLink: videoRoomLink } = await this.resolveVideoRoomLink(
        slot.therapist,
        bookingId,
      );

      // Settle the price before writing the row. The amount charged is not
      // recoverable from the service afterwards: a discount changes it, and the
      // practice may reprice the service at any time.
      const finalPriceKobo = discountResult
        ? BigInt(discountResult.finalKobo)
        : BigInt(service.priceKobo || 0);
      const discountCodeUsed = discountResult
        ? dto.discountCode!.toUpperCase().trim()
        : null;

      // A free booking has nothing to transfer, so it confirms as usual below.
      const manual = manualDetails !== null && finalPriceKobo > 0n;
      const booking = await tx.consultBooking.create({
        data: {
          tenantId,
          serviceId: service.id,
          availabilityId: slot.id,
          clientProfileId: client.id,
          status: 'PENDING_PAYMENT',
          notes: dto.notes,
          videoRoomName,
          amountKobo: finalPriceKobo,
          discountCodeUsed,
          // BKG-09: an online checkout holds the time for 35 minutes; a transfer for longer.
          ...(manual
            ? { paymentMethod: 'MANUAL', holdExpiresAt: holdExpiry(new Date(), slot.startsAt) }
            : finalPriceKobo > 0n
              ? { holdExpiresAt: onlineHoldExpiry(new Date(), slot.startsAt) }
              : {}),
        },
      });

      // Increment usedCount if a discount code was successfully validated
      if (dto.discountCode) {
        await tx.discountCode.update({
          where: { tenantId_code: { tenantId, code: dto.discountCode.toUpperCase().trim() } },
          data: { usedCount: { increment: 1 } },
        });
      }

      let paymentUrl: string | null = null;
      let accessCode: string | null = null;
      let paymentRef: string | null = null;
      let manualPayment = null;

      if (manual) {
        manualPayment = {
          ...manualDetails!,
          amountKobo: finalPriceKobo.toString(),
          reference: transferReference(booking.id),
          holdExpiresAt: booking.holdExpiresAt!.toISOString(),
        };
      } else if (finalPriceKobo > 0n) {
        const reference = `booking-${booking.id}-${Date.now()}`;
        // Was dto.callbackUrl, straight from the request body. Paystack
        // redirects the payer to whatever it is given, so an unchecked value is
        // a phishing page wearing this checkout as its approach. Built from the
        // practice's own site instead.
        const started = await this.startOnlinePayment(
          tenantId,
          finalPriceKobo,
          client.email,
          reference,
          `${tenantWebOrigin(slot.tenant)}/booking/confirmed`,
        );
        paymentUrl = started.url;
        // The booking wizard opens Paystack as a pop-up from this code.
        accessCode = started.accessCode;
        paymentRef = reference;
        await tx.consultBooking.update({
          where: { id: booking.id },
          data: { paymentRef: reference },
        });
      } else {
        // Free or fully discounted, confirm immediately
        await tx.consultBooking.update({
          where: { id: booking.id },
          data: { status: 'CONFIRMED' },
        });
      }

      return {
        bookingId: booking.id.toString(),
        // Lets the confirmation page build the .ics link without a session —
        // the client may not have an account yet.
        icalToken: CalendarService.icalToken(booking.id),
        status: finalPriceKobo > 0n ? 'PENDING_PAYMENT' : 'CONFIRMED',
        serviceTitle: service.title,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        therapistName: `${slot.therapist.profile.firstName || ''} ${slot.therapist.profile.lastName || ''}`.trim(),
        videoRoomLink,
        paymentUrl,
        accessCode,
        reference: paymentRef,
        holdExpiresAt: booking.holdExpiresAt ? booking.holdExpiresAt.toISOString() : null,
        manualPayment,
      };
    });

    if (result.manualPayment) {
      // After commit, and never failing the booking: the details are on screen too.
      await this.manualPayments.announce(BigInt(result.bookingId)).catch((err) =>
        this.logger.warn(`Could not announce transfer booking ${result.bookingId}: ${(err as Error).message}`),
      );
    }

    // After commit, and never failing the booking. One service owns the
    // booking messages: while money is due the client gets the pay link and
    // never the join link; a free or waived booking is confirmed straight away.
    await this.notifier?.booked(BigInt(result.bookingId)).catch((err) =>
      this.logger.warn(`Could not send booking messages for ${result.bookingId}: ${(err as Error).message}`),
    );
    // BKG-06: the wizard's "What's next" block shows whatever the client still
    // owes; it stays hidden while the list is empty.
    result.forms = await this.notifier
      ?.pendingFormsFor(tenantId, client.id)
      .then((forms) => forms.map((f: any) => ({ ...f, href: `/forms/${f.id}?booking=${result.bookingId}` })))
      .catch(() => []);
    return result;
  }

  /**
   * Starts a Paystack checkout routed to the practice's payout subaccount.
   * A subaccount Paystack rejects (deleted, or made with another Paystack key)
   * used to reach the client as "Failed to initialize payment: Invalid
   * Subaccount" on every booking; now the practice is told to fix it and the
   * client gets a plain message.
   */
  async startOnlinePayment(
    tenantId: bigint,
    amountKobo: bigint,
    email: string,
    reference: string,
    callbackUrl: string,
  ): Promise<StartedPayment> {
    const split = await this.billing.calculateSplitPayout(tenantId, amountKobo);
    if (split.payoutAccountBroken) {
      throw new BadRequestException(await this.billing.payoutAccountRejected(tenantId, 'previously rejected'));
    }
    try {
      const pTx = await this.paystack.initializeTransaction({
        amount: Number(split.therapistPayoutKobo) + Number(split.platformFeeKobo),
        email,
        reference,
        subaccount: split.paystackSubaccountCode || undefined,
        bearer: 'subaccount',
        split: split.tier === 'STARTER' ? 5 : 0,
        callback_url: callbackUrl,
      });
      return { url: pTx.authorization_url, accessCode: pTx.access_code };
    } catch (e: any) {
      const message = String(e?.message ?? '');
      if (/subaccount/i.test(message)) {
        this.logger.warn(`Paystack rejected the payout subaccount for tenant ${tenantId}: ${message}`);
        throw new BadRequestException(await this.billing.payoutAccountRejected(tenantId, message));
      }
      throw new BadRequestException('Failed to initialize payment: ' + (message || 'Unknown error'));
    }
  }

  async getBookingPaymentUrl(tenantId: bigint, bookingId: bigint, email: string) {
    return this.restartOnlinePayment(tenantId, bookingId, { clientEmail: email });
  }

  /**
   * BKG-09: pay again. A live hold gets a fresh 35 minutes; a hold the expiry
   * job released is re-claimed if its time is still free. Never shortens a
   * staff link's longer hold. The amount is the one agreed at booking, not
   * today's list price (a discounted booking keeps its discount).
   */
  async restartOnlinePayment(tenantId: bigint, bookingId: bigint, where: { clientEmail?: string }) {
    const booking = await this.prisma.consultBooking.findFirst({
      where: {
        id: bookingId,
        tenantId,
        paymentMethod: { not: 'MANUAL' },
        ...(where.clientEmail ? { client: { email: where.clientEmail } } : {}),
        OR: [{ status: 'PENDING_PAYMENT' }, { status: 'CANCELLED', holdReleasedAt: { not: null } }],
      },
      include: { service: true, client: true, availability: { select: { startsAt: true, createdForBooking: true } } },
    });
    if (!booking) throw new NotFoundException('Pending payment booking not found');

    const fresh = onlineHoldExpiry(new Date(), booking.availability.startsAt);
    const hold = booking.holdExpiresAt && booking.holdExpiresAt > fresh ? booking.holdExpiresAt : fresh;

    if (booking.status === 'CANCELLED') {
      const reclaimed = await this.prisma.$transaction(async (tx) => {
        const free = booking.availability.createdForBooking
          ? (await tx.consultBooking.count({ where: { availabilityId: booking.availabilityId, status: { not: 'CANCELLED' } } })) === 0
          : (await tx.consultAvailability.updateMany({ where: { id: booking.availabilityId, isActive: true }, data: { isActive: false } })).count === 1;
        if (!free) return false;
        const done = await tx.consultBooking.updateMany({
          where: { id: booking.id, status: 'CANCELLED' },
          data: { status: 'PENDING_PAYMENT', holdReleasedAt: null, holdExpiresAt: hold },
        });
        return done.count === 1;
      });
      // Worded like createBooking's, so the wizard shows its "time was just booked" step.
      if (!reclaimed) throw new BadRequestException('The selected time slot is no longer available');
    }

    const reference = `booking-${booking.id}-${Date.now()}`;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, customDomain: true, customDomainStatus: true },
    });
    const started = await this.startOnlinePayment(
      tenantId,
      chargedKobo(booking),
      booking.client.email,
      reference,
      `${tenantWebOrigin(tenant ?? { slug: '' })}/booking/confirmed`,
    );
    // Only once Paystack accepted it: a failed attempt must not overwrite the
    // reference of one that may still complete, nor extend the hold.
    await this.prisma.consultBooking.update({ where: { id: booking.id }, data: { paymentRef: reference, holdExpiresAt: hold } });
    return { paymentUrl: started.url, accessCode: started.accessCode, reference, holdExpiresAt: hold.toISOString() };
  }


  /**
   * Called when Paystack's pop-up reports success, so the client sees
   * "You're booked" at once instead of waiting for the webhook. Asks Paystack
   * itself rather than trusting the browser, and confirms through the same
   * code as the webhook, which ignores a booking that's already confirmed.
   */
  async confirmPublicPayment(tenantId: bigint, clientProfileId: bigint, bookingId: bigint) {
    const booking = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId, clientProfileId },
      select: { id: true, status: true, paymentRef: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === 'CONFIRMED') return { status: 'CONFIRMED' as const, forms: await this.pendingFormLinks(tenantId, clientProfileId, bookingId) };
    if (!booking.paymentRef) return { status: 'PENDING_PAYMENT' as const, forms: await this.pendingFormLinks(tenantId, clientProfileId, bookingId) };
    const tx = await this.paystack.verifyTransaction(booking.paymentRef);
    if (tx?.status !== 'success') return { status: 'PENDING_PAYMENT' as const, forms: await this.pendingFormLinks(tenantId, clientProfileId, bookingId) };
    // BKG-09: the same settler as the webhook, so whichever arrives first
    // confirms (once), a late payment re-claims a still-free time, or it's refunded.
    if (!this.settler) throw new Error('Booking payments cannot be settled: BookingPaymentSettler is not wired.');
    const outcome = await this.settler.settle(booking.paymentRef, tx);
    if (outcome === 'refunded') return { status: 'REFUNDED' as const, forms: [] };
    return { status: 'CONFIRMED' as const, forms: await this.pendingFormLinks(tenantId, clientProfileId, bookingId) };
  }

  /** BKG-06: the client's outstanding default forms, linked for the wizard. */
  private async pendingFormLinks(tenantId: bigint, clientProfileId: bigint, bookingId: bigint) {
    const forms = await this.notifier?.pendingFormsFor(tenantId, clientProfileId).catch(() => []);
    return (forms ?? []).map((f: any) => ({ ...f, href: `/forms/${f.id}?booking=${bookingId}` }));
  }

  async getTherapistBookings(tenantId: bigint, providerProfileId: bigint) {
    const bookings = await this.prisma.consultBooking.findMany({
      where: {
        tenantId,
        availability: { providerProfileId },
      },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true },
        },
        service: true,
        availability: true,
      },
      orderBy: { availability: { startsAt: 'desc' } },
    });

    const creatorIds = [...new Set(bookings.map((b) => b.createdByProfileId).filter((v): v is bigint => v !== null))];
    const creators = creatorIds.length
      ? await this.prisma.profile.findMany({ where: { tenantId, id: { in: creatorIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const creatorName = new Map(creators.map((c) => [c.id.toString(), `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()]));

    return bookings.map((b) => ({
      id: b.id.toString(),
      clientId: b.client.id.toString(),
      clientName: `${b.client.firstName || ''} ${b.client.lastName || ''}`.trim() || 'Client',
      clientEmail: b.client.email,
      clientPhone: b.client.phone,
      serviceTitle: b.service.title,
      durationMinutes: b.service.durationMinutes,
      startsAt: b.availability.startsAt.toISOString(),
      endsAt: b.availability.endsAt.toISOString(),
      status: b.status,
      videoRoomLink: b.videoRoomName ? (b.videoRoomName.startsWith('http') ? b.videoRoomName : `https://meet.jit.si/${b.videoRoomName}`) : null,
      notes: b.notes,
      paymentMethod: b.paymentMethod,
      amountKobo: b.amountKobo !== null ? b.amountKobo.toString() : null,
      holdExpiresAt: b.holdExpiresAt ? b.holdExpiresAt.toISOString() : null,
      bookedBy: b.createdByProfileId ? creatorName.get(b.createdByProfileId.toString()) || 'Staff' : null,
    }));
  }

  /**
   * A client's own sessions.
   *
   * Takes the caller's profile id from their token rather than an email in the
   * query string. The previous version was reachable without any session and
   * looked the client up by email alone, so anyone who knew or guessed an
   * address could read that person's appointment history — and the response
   * carries Jitsi join links, which are themselves unauthenticated.
   */
  /**
   * What the signed-in client has been charged, and what is still owed.
   *
   * The portal's payments tab was a placeholder reading "payment history is not
   * wired yet". Amounts come from the booking's own amountKobo — the figure
   * agreed at booking time — not from the service's price today, which moves
   * when the practice reprices and is simply wrong for a discounted booking.
   */
  async getClientPayments(tenantId: bigint, clientProfileId: bigint) {
    const bookings = await this.prisma.consultBooking.findMany({
      // Scoped to the client in the session. This is billing history, so it must
      // never be addressable by anything the caller supplies.
      where: { tenantId, clientProfileId },
      include: {
        service: { select: { title: true, priceKobo: true } },
        availability: { select: { startsAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const payments = bookings.map((booking) => ({
      bookingId: booking.id.toString(),
      serviceTitle: booking.service.title,
      sessionAt: booking.availability.startsAt.toISOString(),
      amountKobo: chargedKobo(booking).toString(),
      discountCode: booking.discountCodeUsed,
      status: booking.status,
      paidAt: booking.paidAt ? booking.paidAt.toISOString() : null,
      // Enough of the Paystack reference to match against a bank statement
      // without printing the whole thing back over the wire.
      reference: booking.paymentRef,
      bookedAt: booking.createdAt.toISOString(),
    }));

    const paidKobo = payments
      .filter((p) => p.paidAt)
      .reduce((total, p) => total + BigInt(p.amountKobo), 0n);
    const outstandingKobo = payments
      .filter((p) => p.status === 'PENDING_PAYMENT')
      .reduce((total, p) => total + BigInt(p.amountKobo), 0n);

    return {
      payments,
      totalPaidKobo: paidKobo.toString(),
      outstandingKobo: outstandingKobo.toString(),
    };
  }

  /**
   * The booking a client is allowed to move, with the reason if they are not.
   *
   * Shared by the options list and the reschedule itself, so the two can never
   * disagree about what is movable — offering a slot the write then refuses is
   * the failure mode this exists to prevent.
   */
  private async loadReschedulable(tenantId: bigint, clientProfileId: bigint, bookingId: bigint) {
    const booking = await this.prisma.consultBooking.findFirst({
      // Scoped by client as well as tenant: without clientProfileId any signed-in
      // client could move a stranger's appointment by guessing a booking id.
      where: { id: bookingId, tenantId, clientProfileId },
      include: { availability: true, service: true },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      throw new BadRequestException(`A ${booking.status.toLowerCase()} session cannot be moved`);
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { cancellationHours: true },
    });
    const noticeHours = tenant?.cancellationHours ?? 24;
    const deadline = new Date(
      booking.availability.startsAt.getTime() - noticeHours * 60 * 60 * 1000,
    );

    if (new Date() > deadline) {
      throw new BadRequestException(
        `This session can no longer be moved online — it starts within ${noticeHours} hours. Please contact the practice.`,
      );
    }

    return { booking, noticeHours };
  }

  /**
   * Slots this booking could move to: same practitioner, same service, still
   * open, still in the future.
   *
   * Keeping the practitioner fixed is deliberate — the payout split, the
   * practitioner's prep and their calendar are all tied to who is seeing the
   * client, so switching therapist is a new booking, not a reschedule.
   */
  async getRescheduleOptions(tenantId: bigint, clientProfileId: bigint, bookingId: bigint) {
    const { booking, noticeHours } = await this.loadReschedulable(
      tenantId,
      clientProfileId,
      bookingId,
    );

    const slots = await this.prisma.consultAvailability.findMany({
      where: {
        tenantId,
        providerProfileId: booking.availability.providerProfileId,
        serviceId: booking.serviceId,
        isActive: true,
        // A slot that starts sooner than the notice window would be unmovable
        // the moment it was booked, so it is not worth offering.
        startsAt: { gte: new Date(Date.now() + noticeHours * 60 * 60 * 1000) },
        id: { not: booking.availabilityId },
      },
      orderBy: { startsAt: 'asc' },
      take: 60,
    });

    return {
      bookingId: booking.id.toString(),
      serviceTitle: booking.service.title,
      currentStartsAt: booking.availability.startsAt.toISOString(),
      noticeHours,
      slots: slots.map((slot) => ({
        id: slot.id.toString(),
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        channel: slot.channel,
      })),
    };
  }

  /**
   * Move a booking to another open slot.
   *
   * The new slot is claimed with the same conditional `updateMany` the original
   * booking uses: the WHERE still requires `isActive: true`, so Postgres holds
   * the row lock while evaluating it and a second request matches nothing
   * rather than double-booking the time. Releasing the old slot and repointing
   * the booking happen in that same transaction, so a failure part-way cannot
   * leave the client holding two slots or none.
   */
  async rescheduleBooking(
    tenantId: bigint,
    clientProfileId: bigint,
    bookingId: bigint,
    newAvailabilityId: bigint,
  ) {
    const { booking } = await this.loadReschedulable(tenantId, clientProfileId, bookingId);

    if (newAvailabilityId === booking.availabilityId) {
      throw new BadRequestException('That is the time this session is already booked for');
    }

    const target = await this.prisma.consultAvailability.findFirst({
      where: { id: newAvailabilityId, tenantId },
    });

    if (!target || !target.isActive) {
      throw new BadRequestException('That time is no longer available');
    }
    if (target.startsAt <= new Date()) {
      throw new BadRequestException('That time is in the past');
    }
    if (target.providerProfileId !== booking.availability.providerProfileId) {
      throw new BadRequestException(
        'That time belongs to a different practitioner. Book a new session instead.',
      );
    }
    if (target.serviceId !== booking.serviceId) {
      throw new BadRequestException('That time is not open for this service');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.consultAvailability.updateMany({
        where: { id: target.id, tenantId, isActive: true },
        data: { isActive: false },
      });
      if (claimed.count === 0) {
        throw new BadRequestException('That time was taken while you were choosing it');
      }

      // Only now is the old slot safe to give back, unless staff made it for
      // this booking alone: it may be outside working hours.
      await tx.consultAvailability.updateMany({
        where: { id: booking.availabilityId, tenantId, createdForBooking: false },
        data: { isActive: true },
      });

      const moved = await tx.consultBooking.updateMany({
        where: { id: booking.id, tenantId, clientProfileId },
        data: { availabilityId: target.id, updatedAt: new Date() },
      });
      if (moved.count === 0) {
        throw new BadRequestException('Booking not found');
      }

      return tx.consultBooking.findFirst({
        where: { id: booking.id, tenantId },
        include: { availability: true, service: true, client: true },
      });
    });

    if (!updated) throw new NotFoundException('Booking not found');

    const clientName =
      `${updated.client.firstName || ''} ${updated.client.lastName || ''}`.trim() ||
      updated.client.email;
    const when = updated.availability.startsAt.toISOString();

    // Best effort from here: the booking has already moved, and a failed
    // notification must not roll that back or surface as an error to the client.
    try {
      await this.notifications.notify({
        tenantId,
        profileIds: [updated.availability.providerProfileId],
        type: 'consult.booking_rescheduled',
        title: 'Session moved',
        message: `${clientName} moved their ${updated.service.title} session to ${when}.`,
        link: `/portal/clients/${updated.clientProfileId}`,
        preferenceCategory: 'reminders',
      });
    } catch (err) {
      this.logger.warn(`Reschedule notice failed for booking ${bookingId}: ${err}`);
    }

    try {
      await this.calendar.pushBookingToGoogle(updated.id);
    } catch (err) {
      this.logger.warn(`Google calendar update failed for booking ${bookingId}: ${err}`);
    }

    return {
      id: updated.id.toString(),
      startsAt: updated.availability.startsAt.toISOString(),
      endsAt: updated.availability.endsAt.toISOString(),
      status: updated.status,
    };
  }

  async getClientPortal(tenantId: bigint, profileId: bigint) {
    const client = await this.prisma.profile.findFirst({
      where: { id: profileId, tenantId },
    });

    if (!client) {
      return {
        clientName: '',
        upcoming: [],
        past: [],
      };
    }

    const bookings = await this.prisma.consultBooking.findMany({
      where: {
        tenantId,
        clientProfileId: client.id,
      },
      include: {
        service: true,
        availability: {
          include: {
            therapist: {
              include: {
                profile: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
      orderBy: { availability: { startsAt: 'desc' } },
    });

    const now = new Date();
    const manualDetails = bookings.some((b) => b.paymentMethod === 'MANUAL' && b.status === 'PENDING_PAYMENT')
      ? await this.manualPayments.available(tenantId)
      : null;
    const mapped = bookings.map((booking) => ({
      id: booking.id.toString(),
      icalToken: CalendarService.icalToken(booking.id),
      serviceTitle: booking.service.title,
      startsAt: booking.availability.startsAt.toISOString(),
      endsAt: booking.availability.endsAt.toISOString(),
      status: booking.status,
      priceKobo: booking.service.priceKobo.toString(),
      therapistName: `${booking.availability.therapist.profile.firstName || ''} ${booking.availability.therapist.profile.lastName || ''}`.trim() || 'Your therapist',
      videoRoomLink: booking.videoRoomName ? (booking.videoRoomName.startsWith('http') ? booking.videoRoomName : `https://meet.jit.si/${booking.videoRoomName}`) : null,
      paymentMethod: booking.paymentMethod,
      // How to pay a transfer that is still due.
      manualPayment:
        booking.paymentMethod === 'MANUAL' && booking.status === 'PENDING_PAYMENT'
          ? {
              ...(manualDetails ?? {}),
              amountKobo: chargedKobo(booking).toString(),
              reference: transferReference(booking.id),
              holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
              reportedPaidAt: booking.clientReportedPaidAt?.toISOString() ?? null,
            }
          : null,
    }));

    const upcoming = mapped.filter((booking) => new Date(booking.startsAt) >= now && booking.status !== 'CANCELLED');
    const past = mapped.filter((booking) => new Date(booking.startsAt) < now || booking.status === 'COMPLETED');

    return {
      clientName: `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.email,
      upcoming,
      past,
    };
  }

  async updateBookingStatus(tenantId: bigint, providerProfileId: bigint, bookingId: bigint, status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED') {
    const booking = await this.prisma.consultBooking.findFirst({
      where: {
        id: bookingId,
        tenantId,
        availability: { providerProfileId },
      },
      include: {
        client: {
          select: { firstName: true, lastName: true, email: true },
        },
        service: true,
        availability: true,
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    const updated = await this.prisma.consultBooking.update({
      where: { id: bookingId },
      data: { status },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        service: true,
        availability: true,
      },
    });

    if (status === 'CANCELLED') {
      await this.notifier?.notifyStaff(bookingId, 'cancelled').catch(() => undefined);
    }

    if (status === 'COMPLETED') {
      const note = await this.prisma.clinicalNote.findFirst({
        where: { bookingId },
      });
      if (!note) {
        const clientName = `${updated.client.firstName || ''} ${updated.client.lastName || ''}`.trim() || 'Client';
        await this.notifications.notify({
          tenantId,
          profileIds: [providerProfileId],
          type: 'consult.soap_reminder',
          title: 'Session complete — note pending',
          message: `Write your SOAP note for ${clientName}'s session to complete the record.`,
          link: `/portal/clients/${updated.client.id}?tab=notes&booking=${bookingId}`,
          preferenceCategory: 'reminders',
        });
      }
    }

    return {
      id: updated.id.toString(),
      clientName: `${updated.client.firstName || ''} ${updated.client.lastName || ''}`.trim() || 'Client',
      clientEmail: updated.client.email,
      serviceTitle: updated.service.title,
      startsAt: updated.availability.startsAt.toISOString(),
      endsAt: updated.availability.endsAt.toISOString(),
      status: updated.status,
    };
  }

  async getBookingPrep(tenantId: bigint, providerProfileId: bigint, bookingId: bigint) {
    const booking = await this.prisma.consultBooking.findFirst({
      where: {
        id: bookingId,
        tenantId,
        availability: { providerProfileId },
      },
      include: {
        client: true,
        service: true,
        availability: true,
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    const [latestNote, submissions, nextBooking] = await Promise.all([
      this.prisma.clinicalNote.findFirst({
        where: {
          tenantId,
          clientProfileId: booking.clientProfileId,
          NOT: { bookingId },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.universalFormSubmission.findMany({
        where: { tenantId, bookingId },
        include: { form: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.consultBooking.findFirst({
        where: {
          tenantId,
          availabilityId: { not: booking.availabilityId },
          availability: {
            providerProfileId,
            startsAt: { gt: booking.availability.startsAt },
          },
        },
        include: { client: true, availability: true },
        orderBy: { availability: { startsAt: 'asc' } },
      }),
    ]);

    return {
      booking: {
        id: booking.id.toString(),
        clientProfileId: booking.clientProfileId.toString(),
        clientName: `${booking.client.firstName || ''} ${booking.client.lastName || ''}`.trim() || booking.client.email,
        clientEmail: booking.client.email,
        startsAt: booking.availability.startsAt.toISOString(),
        endsAt: booking.availability.endsAt.toISOString(),
        serviceTitle: booking.service.title,
        status: booking.status,
        videoRoomLink: booking.videoRoomName ? (booking.videoRoomName.startsWith('http') ? booking.videoRoomName : `https://meet.jit.si/${booking.videoRoomName}`) : null,
      },
      latestNote: latestNote
        ? {
          id: latestNote.id.toString(),
          // Stored encrypted; the practitioner reading their own note is
          // exactly who it is decrypted for.
          ...(({ subjective, objective, assessment, plan }) => ({
            subjective,
            objective,
            assessment,
            plan,
          }))(decryptNoteFields(latestNote)),
          isLocked: latestNote.isLocked,
          createdAt: latestNote.createdAt.toISOString(),
        }
        : null,
      submissions: submissions.map((submission) => ({
        id: submission.id.toString(),
        formTitle: submission.form.title,
        targetType: submission.targetType,
        status: submission.status,
        submittedAt: submission.createdAt.toISOString(),
        answers: Object.entries((submission.answersJson || {}) as Record<string, unknown>).map(([key, value]) => ({ key, value })),
      })),
      nextBooking: nextBooking
        ? {
          clientName: `${nextBooking.client.firstName || ''} ${nextBooking.client.lastName || ''}`.trim() || nextBooking.client.email,
          startsAt: nextBooking.availability.startsAt.toISOString(),
          endsAt: nextBooking.availability.endsAt.toISOString(),
        }
        : null,
    };
  }

  /**
   * Builds the video room for a booking.
   *
   * The name used to be `unclutterdesk-session-${Date.now()}`. Jitsi rooms are
   * unauthenticated and spring into existence when someone joins, so a
   * guessable name means a stranger can sweep a range of timestamps — or simply
   * learn the scheme from one link — and be waiting inside a therapy session
   * before the therapist arrives. The name now carries 128 bits of randomness.
   */
  async resolveVideoRoomLink(therapist: any, _bookingRef: number): Promise<{ roomName: string; roomLink: string }> {
    const provider = (therapist.videoProvider || 'JITSI').toUpperCase();
    const defaultRoomName = `unclutterdesk-session-${randomBytes(16).toString('hex')}`;

    if (provider === 'DAILY') {
      const apiKey = therapist.dailyApiKey || process.env.DAILY_PLATFORM_API_KEY;
      if (apiKey) {
        try {
          const res = await fetch('https://api.daily.co/v1/rooms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              name: defaultRoomName,
              properties: {
                enable_chat: true,
                exp: Math.floor(Date.now() / 1000) + 86400, // 24hr expiration
              },
            }),
          });
          const data = await res.json();
          if (data?.url) {
            return { roomName: data.name || defaultRoomName, roomLink: data.url };
          }
        } catch {
          // Fallback to Jitsi if Daily API call fails
        }
      }
    }

    // Default: Free instant Jitsi Meet
    return {
      roomName: defaultRoomName,
      roomLink: `https://meet.jit.si/${defaultRoomName}`,
    };
  }

  /**
   * The practice dashboard.
   *
   * Revenue here is money collected, taken from each booking's own amountKobo.
   * It used to sum `service.priceKobo` over every booking created this month
   * with a CONFIRMED or COMPLETED status, which overstated the figure three
   * ways: a discounted booking was counted at full list price, a repriced
   * service revalued bookings made months ago, and a booking confirmed but
   * never paid for was counted as income.
   */
  async getDashboardSummary(tenantId: bigint) {
    const now = new Date();
    // Twelve buckets ending with the current month, so the chart has a real
    // series behind it instead of a ramp derived from this month's figure.
    const seriesStart = startOfMonth(now, 11);

    const [paidBookings, upcomingBookings, totalClientsCount, activeRosterCount, availabilityCount, serviceCount, payoutCount] = await Promise.all([
      this.prisma.consultBooking.findMany({
        where: { tenantId, paidAt: { gte: seriesStart } },
        select: {
          amountKobo: true,
          paidAt: true,
          service: { select: { priceKobo: true } },
        },
      }),
      this.prisma.consultBooking.findMany({
        where: {
          tenantId,
          status: 'CONFIRMED',
          availability: { startsAt: { gte: now } },
        },
        include: { client: true, service: true, availability: true },
        orderBy: { availability: { startsAt: 'asc' } },
        take: 10,
      }),
      this.prisma.profile.count({
        where: { tenantId, role: 'CLIENT' },
      }),
      this.prisma.profile.count({
        where: { tenantId, type: 'therapist', status: 'active' },
      }),
      this.prisma.consultAvailability.count({ where: { tenantId } }),
      this.prisma.consultService.count({ where: { tenantId } }),
      this.prisma.bankSubaccount.count({ where: { tenantId, isVerified: true } }),
    ]);

    const monthlyRevenue = revenueByMonth(paidBookings, now);
    const thisMonth = monthlyRevenue[monthlyRevenue.length - 1];
    const hasAvailability = availabilityCount > 0;
    const hasService = serviceCount > 0;
    const hasPayout = payoutCount > 0;
    const onboardingCompleted = hasAvailability && hasService && hasPayout;

    return {
      revenueThisMonthNaira: thisMonth.revenueNaira,
      revenueThisMonthKobo: thisMonth.revenueKobo,
      monthlyRevenue,
      // Null when last month earned nothing: growth from zero has no
      // percentage, and the page used to show a fixed "+100%" instead.
      revenueChangePercent: changePercent(monthlyRevenue),
      scheduledSessionsCount: upcomingBookings.length,
      totalClientsCount,
      activeRosterCount: activeRosterCount || 1,
      hasAvailability,
      hasService,
      hasPayout,
      onboardingCompleted,
      upcomingSessions: upcomingBookings.map((b) => ({
        id: b.id.toString(),
        clientName: `${b.client.firstName || ''} ${b.client.lastName || ''}`.trim() || b.client.email,
        serviceTitle: b.service.title,
        startsAt: b.availability.startsAt.toISOString(),
        endsAt: b.availability.endsAt.toISOString(),
        status: b.status,
      })),
    };
  }
}
