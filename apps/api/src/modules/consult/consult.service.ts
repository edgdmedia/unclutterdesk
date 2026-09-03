import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { DiscountService } from '../discount/discount.service';
import { BillingService } from '../billing/billing.service';
import { PaystackService } from '../billing/paystack.service';
import { CalendarService } from '../calendar/calendar.service';

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
    if (!avatarUrl || typeof avatarUrl !== 'string') {
      throw new BadRequestException('Valid avatar URL or data is required');
    }

    // profileId comes from the caller's own token, so this was not reachable
    // across tenants — but scoping it here enforces the invariant in the query
    // rather than relying on every future caller passing the right thing.
    const result = await this.prisma.profile.updateMany({
      where: { id: profileId, tenantId },
      data: { avatarUrl },
    });

    if (result.count === 0) {
      throw new NotFoundException('Profile not found in this practice');
    }

    return { success: true, avatarUrl };
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
      orderBy: { durationMinutes: 'asc' },
    });

    return services.map((s) => ({
      id: s.id.toString(),
      title: s.title,
      description: s.description,
      durationMinutes: s.durationMinutes,
      priceKobo: s.priceKobo.toString(),
      isActive: s.isActive,
    }));
  }

  async createService(tenantId: bigint, dto: {
    title: string;
    description?: string;
    durationMinutes?: number;
    priceKobo?: number | string;
  }) {
    const service = await this.prisma.consultService.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        durationMinutes: dto.durationMinutes || 50,
        priceKobo: BigInt(dto.priceKobo || 0),
        isActive: true,
      },
    });

    return {
      id: service.id.toString(),
      title: service.title,
      durationMinutes: service.durationMinutes,
      priceKobo: service.priceKobo.toString(),
    };
  }

  async getPublicAvailability(tenantId: bigint, providerProfileId?: bigint, serviceId?: bigint) {
    const now = new Date();
    const slots = await this.prisma.consultAvailability.findMany({
      where: {
        tenantId,
        isActive: true,
        startsAt: { gte: now },
        ...(providerProfileId ? { providerProfileId } : {}),
        ...(serviceId ? { serviceId } : {}),
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

    return slots.map((s) => ({
      id: s.id.toString(),
      serviceId: s.serviceId?.toString() || null,
      providerProfileId: s.providerProfileId.toString(),
      therapistName: `${s.therapist.profile.firstName || ''} ${s.therapist.profile.lastName || ''}`.trim() || 'Therapist',
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

    const service = await this.prisma.consultService.findFirst({ where: { tenantId, isActive: true }, orderBy: { createdAt: 'asc' } });
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
          if (slotEnd > now) {
            slotData.push({
              tenantId,
              providerProfileId,
              serviceId: service?.id || null,
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

  async createBooking(tenantId: bigint, dto: {
    serviceId: string;
    availabilityId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    notes?: string;
    discountCode?: string;
    callbackUrl?: string;
  }) {
    const serviceId = BigInt(dto.serviceId);
    const availabilityId = BigInt(dto.availabilityId);
    const email = dto.email.toLowerCase().trim();

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
    
    // Validate discount code if provided
    let discountResult = null;
    if (dto.discountCode && slot.service) {
      discountResult = await this.discountService.validateDiscount(tenantId, dto.discountCode, slot.service.priceKobo);
    }

    const tier = (slot.tenant.subscriptionTier || 'STARTER').toUpperCase();
    if (tier === 'STARTER') {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const count = await this.prisma.consultBooking.count({
        where: { tenantId, createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
      });
      if (count >= 20) {
        throw new BadRequestException('Monthly booking limit reached. Upgrade to Pro to accept unlimited bookings.');
      }
    }

    // Atomic transaction: claim the slot, find or create the client profile,
    // create the booking, and record discount usage.
    const result = await this.prisma.$transaction(async (tx) => {
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

      let clientProfile = await tx.profile.findFirst({
        where: { tenantId, email },
      });

      if (!clientProfile) {
        clientProfile = await tx.profile.create({
          data: {
            tenantId,
            email,
            username: email.split('@')[0],
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            phone: dto.phone,
            type: 'user',
            status: 'active',
          },
        });
      }

      const bookingId = Date.now();
      const { roomName: videoRoomName, roomLink: videoRoomLink } = await this.resolveVideoRoomLink(
        slot.therapist,
        bookingId,
      );

      const booking = await tx.consultBooking.create({
        data: {
          tenantId,
          serviceId: slot.serviceId || serviceId,
          availabilityId: slot.id,
          clientProfileId: clientProfile.id,
          status: 'PENDING_PAYMENT',
          notes: dto.notes,
          videoRoomName,
        },
      });

      // Increment usedCount if a discount code was successfully validated
      if (dto.discountCode) {
        await tx.discountCode.update({
          where: { tenantId_code: { tenantId, code: dto.discountCode.toUpperCase().trim() } },
          data: { usedCount: { increment: 1 } },
        });
      }

      let paymentUrl = null;
      let finalPriceKobo = BigInt(slot.service?.priceKobo || 0);

      if (discountResult) {
        finalPriceKobo = BigInt(discountResult.finalKobo);
      }

      if (finalPriceKobo > 0n) {
        const splitConfig = await this.billing.calculateSplitPayout(tenantId, finalPriceKobo);
        const reference = `booking-${booking.id}-${Date.now()}`;
        
        try {
          const pTx = await this.paystack.initializeTransaction({
            amount: Number(splitConfig.therapistPayoutKobo) + Number(splitConfig.platformFeeKobo),
            email: clientProfile.email,
            reference,
            subaccount: splitConfig.paystackSubaccountCode || undefined,
            bearer: 'subaccount',
            split: splitConfig.tier === 'STARTER' ? 5 : undefined,
            callback_url: dto.callbackUrl,
          });

          paymentUrl = pTx.authorization_url;

          await tx.consultBooking.update({
            where: { id: booking.id },
            data: { paymentRef: reference },
          });
        } catch (e: any) {
          throw new BadRequestException('Failed to initialize payment: ' + (e.message || 'Unknown error'));
        }
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
        serviceTitle: slot.service?.title || 'Therapy Session',
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        therapistName: `${slot.therapist.profile.firstName || ''} ${slot.therapist.profile.lastName || ''}`.trim(),
        videoRoomLink,
        paymentUrl,
      };
    });

    return result;
  }

  async getBookingPaymentUrl(tenantId: bigint, bookingId: bigint, email: string) {
    const booking = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId, client: { email }, status: 'PENDING_PAYMENT' },
      include: { service: true, client: true },
    });

    if (!booking) {
      throw new NotFoundException('Pending payment booking not found');
    }

    const splitConfig = await this.billing.calculateSplitPayout(tenantId, BigInt(booking.service?.priceKobo || 0));
    const reference = `booking-${booking.id}-${Date.now()}`;

    await this.prisma.consultBooking.update({
      where: { id: booking.id },
      data: { paymentRef: reference },
    });

    try {
      const pTx = await this.paystack.initializeTransaction({
        amount: Number(splitConfig.therapistPayoutKobo) + Number(splitConfig.platformFeeKobo),
        email: booking.client.email,
        reference,
        subaccount: splitConfig.paystackSubaccountCode || undefined,
        bearer: 'subaccount',
        split: splitConfig.tier === 'STARTER' ? 5 : undefined,
      });

      return { paymentUrl: pTx.authorization_url };
    } catch (e: any) {
      throw new BadRequestException('Failed to initialize payment: ' + (e.message || 'Unknown error'));
    }
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
          subjective: latestNote.subjective,
          objective: latestNote.objective,
          assessment: latestNote.assessment,
          plan: latestNote.plan,
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
  private async resolveVideoRoomLink(therapist: any, _bookingRef: number): Promise<{ roomName: string; roomLink: string }> {
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

  async getDashboardSummary(tenantId: bigint) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [bookingsThisMonth, upcomingBookings, totalClientsCount, activeRosterCount, availabilityCount, serviceCount, payoutCount] = await Promise.all([
      this.prisma.consultBooking.findMany({
        where: {
          tenantId,
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          createdAt: { gte: startOfMonth },
        },
        include: { service: true },
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

    const revenueThisMonthKobo = bookingsThisMonth.reduce((acc, b) => acc + (b.service?.priceKobo ? Number(b.service.priceKobo) : 0), 0);
    const revenueThisMonthNaira = revenueThisMonthKobo / 100;
    const hasAvailability = availabilityCount > 0;
    const hasService = serviceCount > 0;
    const hasPayout = payoutCount > 0;
    const onboardingCompleted = hasAvailability && hasService && hasPayout;

    return {
      revenueThisMonthNaira,
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
