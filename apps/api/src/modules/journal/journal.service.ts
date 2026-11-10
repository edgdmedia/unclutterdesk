import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JOURNAL_APP_ORIGIN, tenantWebOrigin } from '../../common/origins';
import { decryptField, encryptField } from '../../common/field-encryption';
import type { SessionActor } from '../consult/session-directory.service';
import {
  DEFAULT_DELIVERY_TIME,
  PlanError,
  bookingIdOfPlanRef,
  planDays,
  planRef,
  storedPlan,
  validLocalTime,
  validatePlan,
  type JournalPlan,
} from './journal-plan';
import {
  JournalGoneError,
  JournalSuiteClient,
  JournalUnavailableError,
  LINK_REQUEST_TTL_SEC,
  type JournalProgress,
  type JournalSharedItem,
} from './journal-suite.client';

/** At most this many shared entries are taken from one sync. */
const MAX_SHARED_SYNCED = 200;
const MAX_SHARED_CHARS = 50_000;
const MAX_PROMPT_TEXT_CHARS = 2_000;

const fullName = (p: { firstName?: string | null; lastName?: string | null } | null | undefined) =>
  `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim();

function validTimezone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function isoOrNow(v: unknown): Date {
  const d = typeof v === 'string' ? new Date(v) : new Date(NaN);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

type LinkRow = { id: bigint; tenantId: bigint; clientProfileId: bigint; suiteLinkId: string; profileName: string | null; createdAt: Date; endedAt: Date | null };

/**
 * A practitioner's Journal plan, delivered in the client's own Unclutter
 * Journal (docs/design/journal-integration.md).
 *
 *  - The practitioner writes the plan on the session page (clinical staff).
 *  - The client, on her recap page, links her Journal (once) and adds it.
 *    Nothing goes to Journal until she asks.
 *  - Desk reads her progress (counts and dates, never words) and the entries
 *    she chooses to share, which are kept encrypted and shown to clinical
 *    staff only. When she stops sharing one, its words are removed here too.
 *
 * Only practices with the platform switch (ecosystemIntegrationEnabled) see
 * any of it, and only once the shared secret is set.
 */
@Injectable()
export class JournalService {
  private readonly logger = new Logger(JournalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly suite: JournalSuiteClient,
  ) {}

  // ── Shared helpers ─────────────────────────────────────────────────────────

  /** The practice, when Journal is on for it; null otherwise. */
  private async practice(tenantId: bigint) {
    if (!this.suite.configured()) return null;
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true, customDomain: true, customDomainStatus: true, ecosystemIntegrationEnabled: true },
    });
    return t?.ecosystemIntegrationEnabled ? t : null;
  }

  private async liveLink(tenantId: bigint, clientProfileId: bigint): Promise<LinkRow | null> {
    const link = await this.prisma.journalLink.findUnique({ where: { tenantId_clientProfileId: { tenantId, clientProfileId } } });
    return link && !link.endedAt ? link : null;
  }

  /** Journal says the link is gone: end it here, and the plans it carried. */
  private async endedThere(link: LinkRow) {
    await this.prisma.journalLink.updateMany({ where: { id: link.id, endedAt: null }, data: { endedAt: new Date() } });
    await this.prisma.consultBooking.updateMany({
      where: { tenantId: link.tenantId, clientProfileId: link.clientProfileId, journalPlanAddedAt: { not: null } },
      data: { journalPlanAddedAt: null },
    });
  }

  private unavailable(err: unknown): never {
    if (err instanceof JournalUnavailableError) throw new ServiceUnavailableException(err.message);
    throw err;
  }

  /** Sends (or replaces) a session's plan in her Journal, at her time, in her timezone. */
  private async deliver(link: LinkRow, booking: { id: bigint; journalPlan: unknown }, deliveryTime: string, timezone: string | null) {
    const plan = storedPlan(booking.journalPlan);
    if (!plan) throw new BadRequestException('There is no Journal plan for this session yet.');
    const sent = await this.suite.putPlan(planRef(booking.id), {
      link_id: link.suiteLinkId,
      plan,
      timezone: validTimezone(timezone) ? timezone : 'Africa/Lagos',
      delivery_time_local: deliveryTime,
      starts_on: 'next_day',
    });
    await this.prisma.consultBooking.update({
      where: { id: booking.id },
      data: { journalPlanAddedAt: new Date(), journalDeliveryTime: deliveryTime },
    });
    return sent;
  }

  /**
   * Replaces Desk's copy of the entries she shares with Journal's current
   * list: new and edited entries are stored (encrypted), and any she has
   * stopped sharing lose their words and are marked withdrawn.
   * Returns false when Journal says the link is gone (it is then ended here).
   */
  private async syncShared(link: LinkRow): Promise<boolean> {
    let items: JournalSharedItem[];
    try {
      items = await this.suite.shared(link.suiteLinkId);
    } catch (err) {
      if (err instanceof JournalGoneError) {
        await this.endedThere(link);
        return false;
      }
      throw err;
    }
    if (!Array.isArray(items)) throw new JournalUnavailableError('Unclutter Journal sent an answer Desk could not read.');
    const now = new Date();
    const seen: string[] = [];
    for (const it of items.slice(0, MAX_SHARED_SYNCED)) {
      if (typeof it?.entry_id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(it.entry_id) || typeof it.content !== 'string') continue;
      seen.push(it.entry_id);
      const data = {
        clientProfileId: link.clientProfileId,
        bookingId: bookingIdOfPlanRef(it.plan_ref),
        promptText: encryptField(typeof it.prompt_text === 'string' ? it.prompt_text.slice(0, MAX_PROMPT_TEXT_CHARS) : null),
        content: encryptField(it.content.slice(0, MAX_SHARED_CHARS)),
        writtenAt: isoOrNow(it.written_at),
        entryUpdatedAt: isoOrNow(it.updated_at),
        sharedAt: isoOrNow(it.shared_at),
        withdrawnAt: null,
        syncedAt: now,
      };
      await this.prisma.journalSharedEntry.upsert({
        where: { tenantId_suiteEntryId: { tenantId: link.tenantId, suiteEntryId: it.entry_id } },
        create: { tenantId: link.tenantId, suiteEntryId: it.entry_id, ...data },
        update: data,
      });
    }
    await this.prisma.journalSharedEntry.updateMany({
      where: { tenantId: link.tenantId, clientProfileId: link.clientProfileId, withdrawnAt: null, suiteEntryId: { notIn: seen } },
      data: { withdrawnAt: now, content: null, promptText: null, syncedAt: now },
    });
    return true;
  }

  private async progressOf(link: LinkRow, bookingId: bigint): Promise<JournalProgress | null> {
    try {
      return await this.suite.progress(planRef(bookingId), link.suiteLinkId);
    } catch (err) {
      // The plan is not there (ended, or never arrived): no progress to show.
      if (err instanceof JournalGoneError) return null;
      throw err;
    }
  }

  // ── The practitioner (session page) ────────────────────────────────────────

  private scope(tenantId: bigint, actor: SessionActor, bookingId: bigint) {
    return { id: bookingId, tenantId, ...(actor.viewAll ? {} : { availability: { providerProfileId: actor.profileId } }) };
  }

  private async staffBooking(tenantId: bigint, actor: SessionActor, bookingId: bigint) {
    if (!actor.clinical) throw new ForbiddenException('Only clinical staff can see Journal plans and entries.');
    const b = await this.prisma.consultBooking.findFirst({
      where: this.scope(tenantId, actor, bookingId),
      select: { id: true, clientProfileId: true, journalPlan: true, journalPlanAddedAt: true, journalDeliveryTime: true },
    });
    if (!b) throw new NotFoundException('Session not found');
    return b;
  }

  /** What the session page shows: the plan, whether she has it, how far she has got, and what she shares. */
  async staffView(tenantId: bigint, actor: SessionActor, bookingId: bigint) {
    const b = await this.staffBooking(tenantId, actor, bookingId);
    if (!(await this.practice(tenantId))) return { available: false as const };

    let link = await this.liveLink(tenantId, b.clientProfileId);
    let progress: JournalProgress | null = null;
    let syncError: string | null = null;
    if (link) {
      try {
        if (await this.syncShared(link)) {
          if (b.journalPlanAddedAt) progress = await this.progressOf(link, b.id);
        } else {
          link = null;
        }
      } catch (err) {
        if (!(err instanceof JournalUnavailableError)) throw err;
        // Shown with what Desk already has.
        syncError = err.message;
      }
    }
    const added = link && b.journalPlanAddedAt ? b.journalPlanAddedAt : null;
    const entries = await this.prisma.journalSharedEntry.findMany({
      where: { tenantId, clientProfileId: b.clientProfileId, bookingId: b.id },
      orderBy: { writtenAt: 'asc' },
    });
    return {
      available: true as const,
      plan: storedPlan(b.journalPlan),
      addedAt: added ? added.toISOString() : null,
      deliveryTime: added ? b.journalDeliveryTime ?? DEFAULT_DELIVERY_TIME : null,
      link: link ? { profileName: link.profileName, since: link.createdAt.toISOString() } : null,
      progress: progress
        ? {
            status: progress.status,
            total: progress.total,
            delivered: progress.delivered,
            responded: progress.responded,
            lastRespondedAt: progress.last_responded_at,
            nextDeliveryAt: progress.next_delivery_at,
          }
        : null,
      syncError,
      shared: entries.map((e) => ({
        id: e.id.toString(),
        promptText: e.withdrawnAt ? null : decryptField(e.promptText),
        content: e.withdrawnAt ? null : decryptField(e.content),
        writtenAt: e.writtenAt.toISOString(),
        updatedAt: e.entryUpdatedAt.toISOString(),
        sharedAt: e.sharedAt.toISOString(),
        withdrawnAt: e.withdrawnAt ? e.withdrawnAt.toISOString() : null,
      })),
    };
  }

  /**
   * Writes (or with null, removes) the session's plan. When she already has
   * it in her Journal, the copy there is replaced (or ended) too, carrying on
   * from her day.
   */
  async setPlan(tenantId: bigint, actor: SessionActor, bookingId: bigint, raw: unknown) {
    const b = await this.staffBooking(tenantId, actor, bookingId);
    if (!(await this.practice(tenantId))) throw new ForbiddenException('Unclutter Journal is not switched on for this practice.');
    const link = b.journalPlanAddedAt ? await this.liveLink(tenantId, b.clientProfileId) : null;

    if (raw === null) {
      let syncError: string | null = null;
      if (link) {
        try {
          await this.suite.endPlan(planRef(b.id), link.suiteLinkId);
        } catch (err) {
          if (err instanceof JournalUnavailableError) syncError = err.message;
          else if (!(err instanceof JournalGoneError)) throw err;
        }
      }
      // Not removed here while her Journal would carry on delivering it.
      if (syncError) throw new ServiceUnavailableException(`${syncError} The plan was not removed.`);
      await this.prisma.consultBooking.update({
        where: { id: b.id },
        data: { journalPlan: Prisma.DbNull, journalPlanAddedAt: null, journalDeliveryTime: null },
      });
      return { plan: null, addedAt: null, syncError: null };
    }

    let plan: JournalPlan;
    try {
      plan = validatePlan(raw);
    } catch (err) {
      if (err instanceof PlanError) throw new BadRequestException(err.message);
      throw err;
    }
    await this.prisma.consultBooking.update({ where: { id: b.id }, data: { journalPlan: plan as unknown as Prisma.InputJsonValue } });

    let syncError: string | null = null;
    if (link) {
      const client = await this.prisma.profile.findUnique({ where: { id: b.clientProfileId }, select: { timezone: true } });
      try {
        await this.deliver(link, { id: b.id, journalPlan: plan }, b.journalDeliveryTime ?? DEFAULT_DELIVERY_TIME, client?.timezone ?? null);
      } catch (err) {
        if (err instanceof JournalGoneError) await this.endedThere(link);
        else if (err instanceof JournalUnavailableError) syncError = `Saved here, but her Journal was not updated: ${err.message}`;
        else throw err;
      }
    }
    const after = await this.prisma.consultBooking.findUnique({ where: { id: b.id }, select: { journalPlanAddedAt: true } });
    return { plan, days: planDays(plan), addedAt: after?.journalPlanAddedAt?.toISOString() ?? null, syncError };
  }

  // ── The client (portal recap page) ─────────────────────────────────────────

  /** Her own session, with a sent recap and a plan; never another client's, never a draft. */
  private async clientBooking(tenantId: bigint, clientProfileId: bigint, bookingId: bigint) {
    const b = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId, clientProfileId, clientRecapSentAt: { not: null } },
      select: {
        id: true,
        journalPlan: true,
        journalPlanAddedAt: true,
        journalDeliveryTime: true,
        client: { select: { timezone: true } },
        availability: { select: { therapist: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
      },
    });
    if (!b) throw new NotFoundException('Recap not found');
    return b;
  }

  /** The Journal part of her recap page. */
  async clientView(tenantId: bigint, clientProfileId: bigint, bookingId: bigint) {
    const b = await this.clientBooking(tenantId, clientProfileId, bookingId);
    const plan = storedPlan(b.journalPlan);
    if (!plan || !(await this.practice(tenantId))) return { available: false as const };
    const link = await this.liveLink(tenantId, clientProfileId);
    const added = link && b.journalPlanAddedAt ? b.journalPlanAddedAt : null;
    let progress: { total: number; responded: number } | null = null;
    if (link && added) {
      try {
        const p = await this.progressOf(link, b.id);
        if (p) progress = { total: p.total, responded: p.responded };
      } catch (err) {
        if (!(err instanceof JournalUnavailableError)) throw err;
      }
    }
    return {
      available: true as const,
      title: plan.title,
      intro: plan.intro,
      days: planDays(plan),
      connected: Boolean(link),
      addedAt: added ? added.toISOString() : null,
      deliveryTime: b.journalDeliveryTime ?? DEFAULT_DELIVERY_TIME,
      progress,
      journalUrl: JOURNAL_APP_ORIGIN,
    };
  }

  /**
   * She chose "Add to my Unclutter Journal" and is not linked yet: the signed
   * request her browser carries to Journal. Its nonce comes back as `state`.
   */
  async connect(tenantId: bigint, clientProfileId: bigint, bookingId: bigint, deliveryTime: unknown) {
    const time = deliveryTime === undefined || deliveryTime === null ? DEFAULT_DELIVERY_TIME : deliveryTime;
    if (!validLocalTime(time)) throw new BadRequestException('Choose a time such as 08:00.');
    const b = await this.clientBooking(tenantId, clientProfileId, bookingId);
    if (!storedPlan(b.journalPlan)) throw new NotFoundException('There is no Journal plan for this session.');
    const practice = await this.practice(tenantId);
    if (!practice) throw new NotFoundException('There is no Journal plan for this session.');

    const nonce = JournalSuiteClient.newNonce();
    const expiresAt = new Date(Date.now() + LINK_REQUEST_TTL_SEC * 1000);
    await this.prisma.journalLinkRequest.create({
      data: { nonce, tenantId, clientProfileId, bookingId: b.id, deliveryTimeLocal: time, expiresAt },
    });
    const url = this.suite.linkUrl(nonce, {
      practiceName: practice.name,
      practitionerName: fullName(b.availability.therapist?.profile) || practice.name,
      clientRef: `t${tenantId}c${clientProfileId}`,
      returnUrl: `${tenantWebOrigin(practice as any)}/portal/journal/linked`,
    });
    return { url };
  }

  /**
   * Back from Journal. `state` must be a request Desk made for this client,
   * unused and in date; then the one-time code is exchanged for the link, and
   * the plan she was adding goes to her Journal.
   */
  async completeLink(tenantId: bigint, clientProfileId: bigint, body: { state?: unknown; code?: unknown; error?: unknown }) {
    const state = typeof body?.state === 'string' ? body.state : '';
    const req = state && state.length <= 100
      ? await this.prisma.journalLinkRequest.findFirst({ where: { nonce: state, tenantId, clientProfileId } })
      : null;
    const expired = 'This link has expired or was already used. Go back to your recap and try again.';
    if (!req || req.usedAt || req.expiresAt.getTime() < Date.now()) throw new BadRequestException(expired);
    // Used once, even if two tabs race.
    const claimed = await this.prisma.journalLinkRequest.updateMany({ where: { nonce: req.nonce, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw new BadRequestException(expired);

    const bookingId = req.bookingId.toString();
    if (body?.error !== undefined && body?.error !== null) return { bookingId, linked: false, added: false, message: null };
    const code = typeof body?.code === 'string' && body.code.length <= 100 ? body.code : '';
    if (!code) throw new BadRequestException(expired);
    if (!(await this.practice(tenantId))) throw new NotFoundException('There is no Journal plan for this session.');

    let exchanged: { link_id: string; profile_name: string | null };
    try {
      exchanged = await this.suite.exchange(code);
    } catch (err) {
      if (err instanceof JournalGoneError) throw new BadRequestException(expired);
      this.unavailable(err);
    }
    if (typeof exchanged?.link_id !== 'string' || !/^dl_[A-Za-z0-9_-]{10,40}$/.test(exchanged.link_id)) {
      throw new ServiceUnavailableException('Unclutter Journal sent an answer Desk could not read.');
    }
    const profileName = typeof exchanged.profile_name === 'string' ? exchanged.profile_name.slice(0, 100) : null;
    const link = await this.prisma.journalLink.upsert({
      where: { tenantId_clientProfileId: { tenantId, clientProfileId } },
      create: { tenantId, clientProfileId, suiteLinkId: exchanged.link_id, profileName },
      update: { suiteLinkId: exchanged.link_id, profileName, endedAt: null },
    });

    const b = await this.prisma.consultBooking.findFirst({
      where: { id: req.bookingId, tenantId, clientProfileId },
      select: { id: true, journalPlan: true, client: { select: { timezone: true } } },
    });
    if (!b || !storedPlan(b.journalPlan)) return { bookingId, linked: true, added: false, message: null };
    try {
      await this.deliver(link, b, req.deliveryTimeLocal, b.client.timezone);
      return { bookingId, linked: true, added: true, message: null };
    } catch (err) {
      if (err instanceof JournalUnavailableError || err instanceof BadRequestException) {
        return { bookingId, linked: true, added: false, message: err.message };
      }
      throw err;
    }
  }

  /** Already linked: add (or re-time) this session's plan in her Journal. */
  async addPlan(tenantId: bigint, clientProfileId: bigint, bookingId: bigint, deliveryTime: unknown) {
    const time = deliveryTime === undefined || deliveryTime === null ? DEFAULT_DELIVERY_TIME : deliveryTime;
    if (!validLocalTime(time)) throw new BadRequestException('Choose a time such as 08:00.');
    const b = await this.clientBooking(tenantId, clientProfileId, bookingId);
    if (!storedPlan(b.journalPlan) || !(await this.practice(tenantId))) throw new NotFoundException('There is no Journal plan for this session.');
    const link = await this.liveLink(tenantId, clientProfileId);
    if (!link) throw new BadRequestException('Connect your Unclutter Journal first.');
    try {
      const sent = await this.deliver(link, b, time, b.client.timezone);
      return { addedAt: new Date().toISOString(), deliveryTime: time, days: sent.days, nextDeliveryAt: sent.next_delivery_at };
    } catch (err) {
      if (err instanceof JournalGoneError) {
        await this.endedThere(link);
        throw new BadRequestException('Your Journal is no longer connected. Connect it again to add this plan.');
      }
      this.unavailable(err);
    }
  }

  /** She disconnects from the portal: Journal stops delivering this practice's plans and sharing. */
  async disconnect(tenantId: bigint, clientProfileId: bigint) {
    const link = await this.liveLink(tenantId, clientProfileId);
    if (!link) return { connected: false };
    try {
      await this.suite.endLink(link.suiteLinkId);
    } catch (err) {
      if (!(err instanceof JournalGoneError)) this.unavailable(err);
    }
    await this.endedThere(link);
    return { connected: false };
  }

  // ── The practice as a whole ────────────────────────────────────────────────

  /**
   * The platform switch went off (or the practice is closing): every link it
   * holds ends, in Journal and here. A link Journal cannot be told about now
   * is still ended here, and logged so it can be ended in Journal by hand.
   */
  async endAllForTenant(tenantId: bigint) {
    const links = await this.prisma.journalLink.findMany({ where: { tenantId, endedAt: null } });
    for (const link of links) {
      if (this.suite.configured()) {
        try {
          await this.suite.endLink(link.suiteLinkId);
        } catch (err) {
          if (!(err instanceof JournalGoneError)) this.logger.warn(`Could not end Journal link ${link.id} in Journal: ${(err as Error).message}`);
        }
      }
      await this.endedThere(link);
    }
    return { ended: links.length };
  }
}
