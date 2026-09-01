import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CHANNEL_KEYS,
  ChannelBrand,
  ChannelKey,
  ChannelPayload,
  ChannelRecipient,
  DeliveryResult,
  NOTIFICATION_CHANNELS,
  NotificationChannel,
} from './channels/notification.channel';

const POLL_MS = Number(process.env.NOTIFICATION_POLL_MS || 30_000);

export type PreferenceCategory = 'activity' | 'digests' | 'reminders';

export interface NotifyInput {
  tenantId: bigint;
  profileIds: bigint[];
  /** Event type, e.g. "consult.booking_confirmed" — the module is the segment before "." */
  type: string;
  title: string;
  message: string;
  link?: string;
  actionLabel?: string;
  data?: Record<string, unknown>;
  /** Explicit per-channel override (module is trusted). */
  channels?: Partial<Record<ChannelKey, boolean>>;
  /** Preference category; also determines sensible defaults (reminders prefer push over email). */
  preferenceCategory?: PreferenceCategory;
  module?: string;
}

export interface ReminderInput extends Omit<NotifyInput, 'profileIds'> {
  profileId: bigint;
  triggerAt?: Date;
}

export interface SendEmailInput {
  /** Recipient email address. */
  to: string;
  /** Event type, e.g. "auth.password_reset". */
  type: string;
  title: string;
  message: string;
  /** Rendered as a prominent code box (e.g. verification codes). */
  code?: string;
  link?: string;
  actionLabel?: string;
  /** Present when a tenant exists — drives branding; absent for pre-tenant sends. */
  tenantId?: bigint | null;
  /** Present when a profile exists — enables emailLog; absent for pre-tenant sends. */
  profileId?: bigint | null;
}

/**
 * The notification hub. Modules call `notify()` (immediate) or `queueReminder()`
 * (scheduled) and the hub figures out which channels to fire for each recipient:
 *
 *   tenant capabilities (notificationChannels) → caller override → profile
 *   preferences → sensible defaults → provider wiring (channel.isWired()).
 *
 * Tenants plug in by toggling their channel capabilities and brand tokens; new
 * channels (sms, etc.) are added by implementing NotificationChannel and
 * registering it in the module.
 */
@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
  private poller: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_CHANNELS) private readonly channels: NotificationChannel[],
  ) {}

  onModuleInit(): void {
    this.poller = setInterval(() => {
      this.processDueReminders().catch((err) =>
        this.logger.error('Reminder poller failed', err instanceof Error ? err.stack : err),
      );
    }, POLL_MS);
    this.logger.log(`Notification reminder poller started (every ${POLL_MS}ms)`);
  }

  onModuleDestroy(): void {
    if (this.poller) clearInterval(this.poller);
  }

  channel(key: ChannelKey): NotificationChannel | undefined {
    return this.channels.find((c) => c.key === key);
  }

  isChannelWired(key: ChannelKey): boolean {
    return this.channel(key)?.isWired() ?? false;
  }

  // ── Dispatch ───────────────────────────────────────────────────────────────

  async notify(input: NotifyInput): Promise<{ profileId: bigint; channels: ChannelKey[] }[]> {
    const profiles = await this.prisma.profile.findMany({
      where: { id: { in: input.profileIds }, tenantId: input.tenantId },
      select: { id: true, tenantId: true, userId: true, email: true, phone: true, firstName: true },
    });

    const brand = await this.resolveBrand(input.tenantId);
    const results: { profileId: bigint; channels: ChannelKey[] }[] = [];

    for (const profile of profiles) {
      const recipient: ChannelRecipient = {
        profileId: profile.id,
        tenantId: profile.tenantId,
        userId: profile.userId,
        email: profile.email,
        phone: profile.phone,
        firstName: profile.firstName,
      };

      const channels = await this.getEffectiveChannels({
        recipient,
        type: input.type,
        module: input.module,
        category: input.preferenceCategory,
        requested: input.channels,
      });

      results.push({ profileId: profile.id, channels });

      for (const key of channels) {
        try {
          await this.dispatchToChannel(key, recipient, {
            type: input.type,
            title: input.title,
            message: input.message,
            link: input.link,
            actionLabel: input.actionLabel,
            data: input.data,
            brand,
          });
        } catch (e: any) {
          this.logger.error(`[profile ${profile.id}] ${key} channel error: ${e?.message ?? e}`);
        }
      }
    }

    return results;
  }

  /**
   * Direct transactional email (e.g. auth verification / welcome / reset).
   * Unlike `notify()` this bypasses channel prefs and tenant caps — a
   * transactional email always goes out. It is pre-tenant capable: when no
   * tenantId is provided the default (Unclutter Desk) branding is used and no
   * EmailLog row is written; when a tenantId/profileId are present the tenant's
   * brand is resolved and delivery is recorded in EmailLog.
   */
  async sendEmail(input: SendEmailInput): Promise<DeliveryResult> {
    const channel = this.channel('email');
    if (!channel) {
      this.logger.error(`sendEmail: no email channel registered (${input.type})`);
      return { success: false, error: 'Email channel not registered' };
    }

    const brand = input.tenantId != null ? await this.resolveBrand(input.tenantId) : undefined;
    const result = await this.dispatchToChannel(
      'email',
      {
        profileId: input.profileId ?? null,
        tenantId: input.tenantId ?? null,
        email: input.to,
      },
      {
        type: input.type,
        title: input.title,
        message: input.message,
        code: input.code,
        link: input.link,
        actionLabel: input.actionLabel,
        brand,
      },
    );
    return result ?? { success: false, error: 'Email channel not registered' };
  }

  private async dispatchToChannel(
    key: ChannelKey,
    recipient: ChannelRecipient,
    payload: ChannelPayload,
  ): Promise<DeliveryResult | undefined> {
    const channel = this.channel(key);
    if (!channel) return undefined;

    let result: DeliveryResult;
    try {
      result = await channel.send(recipient, payload);
    } catch (e: any) {
      result = { success: false, error: e?.message ?? 'Channel threw' };
    }

    if (key === 'email' && recipient.tenantId != null && recipient.profileId != null) {
      await this.prisma.emailLog
        .create({
          data: {
            tenantId: recipient.tenantId,
            profileId: recipient.profileId,
            type: payload.type,
            to: recipient.email ?? '',
            subject: payload.title,
            providerId: result.providerId ?? null,
            status: result.success ? 'SENT' : 'FAILED',
            error: result.error ?? null,
          },
        })
        .catch((e: any) => this.logger.error(`EmailLog write failed: ${e?.message ?? e}`));
    }

    return result;
  }

  // ── Channel resolution ─────────────────────────────────────────────────────

  private async resolveTenantCapabilities(
    tenantId: bigint,
  ): Promise<Record<ChannelKey, boolean>> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { notificationChannels: true },
    });
    const raw: any = tenant?.notificationChannels ?? null;
    const caps: Record<string, boolean> =
      raw && typeof raw === 'object' ? raw : {};
    return {
      in_app: caps.in_app !== false,
      email: caps.email !== false,
      push: caps.push !== false,
      sms: caps.sms === true, // off unless the tenant explicitly enables it
    };
  }

  private async getEffectiveChannels(opts: {
    recipient: ChannelRecipient;
    type: string;
    module?: string;
    category?: PreferenceCategory;
    requested?: Partial<Record<ChannelKey, boolean>>;
  }): Promise<ChannelKey[]> {
    const tenantCaps = await this.resolveTenantCapabilities(opts.recipient.tenantId);
    const module = opts.module || opts.type.split('.')[0] || 'notification';

    const prefs = await this.prisma.notificationPreference.findMany({
      where: { profileId: opts.recipient.profileId, module },
    });

    const prefFor = (channel: ChannelKey): boolean | null => {
      const match = prefs.find(
        (p) => p.channel === channel && (p.category ?? null) === (opts.category ?? null),
      );
      if (match) return match.enabled;
      const any = prefs.find((p) => p.channel === channel && p.category === null);
      return any ? any.enabled : null;
    };

    const hasPushSubscriptions =
      (await this.prisma.webPushSubscription.count({
        where: { profileId: opts.recipient.profileId, isActive: true },
      })) > 0;

    const defaults: Record<ChannelKey, boolean> = {
      in_app: true,
      email: opts.category === 'reminders' ? false : true,
      push: hasPushSubscriptions,
      sms: false,
    };

    const effective: ChannelKey[] = [];
    for (const key of CHANNEL_KEYS) {
      if (!tenantCaps[key]) continue;
      const requested = opts.requested?.[key];
      const pref = prefFor(key);
      const value = requested !== undefined ? requested : pref !== null ? pref : defaults[key];
      if (value && (key === 'in_app' || this.isChannelWired(key))) effective.push(key);
    }
    return effective;
  }

  async resolveBrand(tenantId: bigint): Promise<ChannelBrand> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        publicEmail: true,
        publicPhone: true,
      },
    });
    return {
      practiceName: tenant?.name ?? 'Unclutter Desk',
      primaryColor: tenant?.primaryColor,
      secondaryColor: tenant?.secondaryColor,
      logoUrl: tenant?.logoUrl,
      publicEmail: tenant?.publicEmail,
      publicPhone: tenant?.publicPhone,
    };
  }

  // ── Scheduled reminders ────────────────────────────────────────────────────

  async queueReminder(input: ReminderInput, dedupeKey?: string): Promise<bigint> {
    if (dedupeKey) {
      const existing = await this.prisma.notificationDispatch.findUnique({
        where: { dedupeKey },
      });
      if (existing) return existing.id; // idempotent
    }
    const dispatch = await this.prisma.notificationDispatch.create({
      data: {
        tenantId: input.tenantId,
        profileId: input.profileId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
        actionLabel: input.actionLabel,
        data: (input.data as Prisma.InputJsonValue) ?? undefined,
        category: input.preferenceCategory ?? null,
        channels: (input.channels as Prisma.InputJsonValue) ?? undefined,
        status: 'PENDING',
        attempts: 0,
        triggerAt: input.triggerAt ?? new Date(),
        dedupeKey: dedupeKey ?? null,
      },
    });
    this.logger.debug(`Queued ${input.type} reminder for profile ${input.profileId} (id=${dispatch.id})`);
    return dispatch.id;
  }

  async cancelReminder(dedupeKey: string): Promise<number> {
    const res = await this.prisma.notificationDispatch.updateMany({
      where: { dedupeKey, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    return res.count;
  }

  async processDueReminders(limit = 50): Promise<number> {
    const due = await this.prisma.notificationDispatch.findMany({
      where: { status: 'PENDING', triggerAt: { lte: new Date() } },
      take: limit,
      orderBy: { triggerAt: 'asc' },
    });
    if (due.length === 0) return 0;

    let processed = 0;
    for (const row of due) {
      try {
        await this.prisma.notificationDispatch.update({
          where: { id: row.id },
          data: { status: 'PROCESSING', attempts: { increment: 1 } },
        });

        const profile = await this.prisma.profile.findUnique({
          where: { id: row.profileId },
          select: { id: true, tenantId: true, userId: true, email: true, phone: true, firstName: true },
        });
        if (!profile) {
          await this.prisma.notificationDispatch.update({
            where: { id: row.id },
            data: { status: 'FAILED', lastError: 'Profile not found' },
          });
          processed++;
          continue;
        }

        const recipient: ChannelRecipient = {
          profileId: profile.id,
          tenantId: profile.tenantId,
          userId: profile.userId,
          email: profile.email,
          phone: profile.phone,
          firstName: profile.firstName,
        };

        const requested = row.channels as Prisma.JsonObject | null;
        const channels = await this.getEffectiveChannels({
          recipient,
          type: row.type,
          category: (row.category as PreferenceCategory) ?? undefined,
          requested: requested as Partial<Record<ChannelKey, boolean>> | undefined,
        });

        const brand = await this.resolveBrand(profile.tenantId);
        let sentCount = 0;
        let notificationId: bigint | null = null;

        for (const key of channels) {
          const result = await this.dispatchToChannel(key, recipient, {
            type: row.type,
            title: row.title,
            message: row.message,
            link: row.link,
            actionLabel: row.actionLabel,
            data: row.data as Record<string, unknown> | undefined,
            brand,
          });
          if (result?.success) {
            sentCount++;
            if (key === 'in_app' && result.providerId) notificationId = BigInt(result.providerId);
          }
        }

        await this.prisma.notificationDispatch.update({
          where: { id: row.id },
          data: {
            status: sentCount === 0 ? 'FAILED' : sentCount === channels.length ? 'SENT' : 'PARTIAL',
            sentAt: sentCount > 0 ? new Date() : null,
            notificationId,
            channels: channels.length
              ? (Object.fromEntries(channels.map((c) => [c, true])) as Prisma.InputJsonValue)
              : undefined,
          },
        });
        processed++;
      } catch (e: any) {
        await this.prisma.notificationDispatch
          .update({
            where: { id: row.id },
            data: { status: 'FAILED', lastError: e?.message ?? 'Reminder processing failed' },
          })
          .catch(() => undefined);
        this.logger.error(`Reminder ${row.id} failed: ${e?.message ?? e}`);
        processed++;
      }
    }
    return processed;
  }

  // ── In-app queries ─────────────────────────────────────────────────────────

  async listForProfile(
    profileId: bigint,
    opts: { unreadOnly?: boolean; page?: number; pageSize?: number } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const where: Prisma.NotificationWhereInput = {
      profileId,
      ...(opts.unreadOnly ? { status: 'unread' } : { status: { in: ['unread', 'read'] } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      items: items.map((n) => ({
        ...n,
        id: n.id.toString(),
        tenantId: n.tenantId.toString(),
        profileId: n.profileId.toString(),
        data: n.data ?? null,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async unreadCount(profileId: bigint): Promise<number> {
    return this.prisma.notification.count({ where: { profileId, status: 'unread' } });
  }

  async markRead(profileId: bigint, notificationId: bigint) {
    const res = await this.prisma.notification.updateMany({
      where: { id: notificationId, profileId, status: 'unread' },
      data: { status: 'read', readAt: new Date() },
    });
    return { updated: res.count };
  }

  async markAllRead(profileId: bigint) {
    const res = await this.prisma.notification.updateMany({
      where: { profileId, status: 'unread' },
      data: { status: 'read', readAt: new Date() },
    });
    return { updated: res.count };
  }

  async markArchived(profileId: bigint, notificationId: bigint) {
    const res = await this.prisma.notification.updateMany({
      where: { id: notificationId, profileId },
      data: { status: 'archived' },
    });
    return { updated: res.count };
  }

  // ── Preferences ────────────────────────────────────────────────────────────

  async getPreferences(profileId: bigint, module?: string) {
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { profileId, ...(module ? { module } : {}) },
      orderBy: [{ module: 'asc' }, { channel: 'asc' }],
    });
    return prefs.map((p) => ({
      id: p.id.toString(),
      module: p.module,
      category: p.category,
      channel: p.channel,
      enabled: p.enabled,
    }));
  }

  async setPreference(
    tenantId: bigint,
    profileId: bigint,
    dto: { module: string; category?: string; channel: ChannelKey; enabled: boolean },
  ) {
    const category = dto.category ?? null;
    const pref = await this.prisma.notificationPreference.upsert({
      where: {
        profileId_module_category_channel: {
          profileId,
          module: dto.module,
          category,
          channel: dto.channel,
        },
      },
      update: { enabled: dto.enabled },
      create: {
        tenantId,
        profileId,
        module: dto.module,
        category,
        channel: dto.channel,
        enabled: dto.enabled,
      },
    });
    return { id: pref.id.toString(), module: pref.module, category: pref.category, channel: pref.channel, enabled: pref.enabled };
  }

  // ── Push subscriptions ─────────────────────────────────────────────────────

  async pushPublicKey(): Promise<string | null> {
    return this.channel('push')?.getPublicKey?.() ?? null;
  }

  async subscribePush(
    tenantId: bigint,
    profileId: bigint,
    dto: { endpoint: string; p256dh: string; auth: string },
  ) {
    const sub = await this.prisma.webPushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: { p256dh: dto.p256dh, auth: dto.auth, tenantId, profileId, isActive: true, lastError: null },
      create: {
        tenantId,
        profileId,
        endpoint: dto.endpoint,
        p256dh: dto.p256dh,
        auth: dto.auth,
      },
    });
    return { id: sub.id.toString(), isActive: sub.isActive };
  }

  async unsubscribePush(profileId: bigint, endpoint: string) {
    const res = await this.prisma.webPushSubscription.updateMany({
      where: { profileId, endpoint },
      data: { isActive: false },
    });
    return { updated: res.count };
  }
}
