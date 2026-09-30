import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { appOrigin } from '../../common/origins';
import { NotificationService } from '../notifications/notification.service';

/** The plans an invite can grant. Starter is free already. */
export const INVITE_TIERS = ['PRO', 'CLINIC'] as const;
export type InviteTier = (typeof INVITE_TIERS)[number];

type Tx = Prisma.TransactionClient | PrismaService;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_MESSAGE = 1000;

/** Where an invite link lands: signup, with the code already filled in. */
export function inviteSignupLink(code: string) {
  return `${appOrigin()}/auth/signup?invite=${encodeURIComponent(code)}`;
}

/** Codes are shown to people and typed in, so compare them loosely. */
export function normalizeInviteCode(code: unknown): string {
  return String(code ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Invite codes: a platform-issued code that gives a practice a paid plan for a
 * set number of days, after which it drops back to Starter unless the practice
 * has started paying.
 *
 * Separate from DiscountCode, which is a practice's own promotion on the price
 * of its clients' sessions.
 */
@Injectable()
export class InviteService {
  private readonly logger = new Logger(InviteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  // ── Platform admin ─────────────────────────────────────────────────────

  async create(dto: {
    code?: string;
    tier?: string;
    durationDays?: number | string;
    maxUses?: number | string | null;
    redeemBy?: string | null;
    note?: string | null;
  }) {
    const tier = String(dto?.tier ?? '').toUpperCase();
    if (!(INVITE_TIERS as readonly string[]).includes(tier)) {
      throw new BadRequestException('Choose the plan the code gives: Pro or Clinic.');
    }

    const durationDays = Number(dto.durationDays ?? 90);
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 730) {
      throw new BadRequestException('Length must be between 1 and 730 days.');
    }

    let maxUses: number | null = null;
    if (dto.maxUses !== undefined && dto.maxUses !== null && String(dto.maxUses).trim() !== '') {
      maxUses = Number(dto.maxUses);
      if (!Number.isInteger(maxUses) || maxUses < 1) {
        throw new BadRequestException('Uses must be a whole number of at least 1, or left empty for no limit.');
      }
    }

    let redeemBy: Date | null = null;
    if (dto.redeemBy) {
      redeemBy = new Date(dto.redeemBy);
      if (Number.isNaN(redeemBy.getTime())) throw new BadRequestException('That redeem-by date is not valid.');
      if (redeemBy <= new Date()) throw new BadRequestException('The redeem-by date must be in the future.');
    }

    const code = dto.code ? normalizeInviteCode(dto.code) : this.generateCode();
    if (!/^[A-Z0-9-]{4,40}$/.test(code)) {
      throw new BadRequestException('Codes are 4 to 40 letters, numbers or dashes.');
    }

    try {
      const created = await this.prisma.inviteCode.create({
        data: { code, tier, durationDays, maxUses, redeemBy, note: dto.note?.trim() || null },
      });
      return this.view({ ...created, tenants: [], sends: [] });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new BadRequestException('That code already exists. Pick another.');
      }
      throw err;
    }
  }

  async list() {
    const codes = await this.prisma.inviteCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        tenants: {
          select: { id: true, name: true, slug: true, subscriptionTier: true, complimentaryUntil: true },
          orderBy: { createdAt: 'desc' },
        },
        sends: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { sentBy: { select: { email: true } } },
        },
      },
    });
    return codes.map((c) => this.view(c));
  }

  /**
   * Emails the invite to one person, with an optional note from the admin.
   * Every attempt is recorded, including ones the mail provider refused, so the
   * console shows who has been invited and whether it reached them.
   */
  async sendByEmail(id: bigint, dto: { email?: string; message?: string | null }, sentById: bigint | null) {
    const email = String(dto?.email ?? '').trim().toLowerCase();
    if (!EMAIL.test(email)) throw new BadRequestException('Enter a valid email address.');
    const message = String(dto?.message ?? '').trim() || null;
    if (message && message.length > MAX_MESSAGE) {
      throw new BadRequestException(`Keep the message under ${MAX_MESSAGE} characters.`);
    }

    const existing = await this.prisma.inviteCode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Invite code not found');
    // An invite nobody can redeem would only disappoint whoever opens it.
    const invite = await this.usable(existing.code);

    const plan = invite.tier === 'CLINIC' ? 'Clinic' : 'Pro';
    const deadline = invite.redeemBy
      ? ` Use it by ${invite.redeemBy.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })}.`
      : '';
    const body = [
      message,
      `You've been invited to Unclutter Desk, practice management for therapists. This invite gives your practice the ${plan} plan free for ${invite.durationDays} days.${deadline}`,
      'Create your practice with the button below, or enter the code when you sign up.',
    ]
      .filter(Boolean)
      .join('\n\n');

    let delivered = false;
    try {
      const result = await this.notifications.sendEmail({
        to: email,
        type: 'platform.invite',
        title: "You're invited to Unclutter Desk",
        message: body,
        code: invite.code,
        codeLabel: 'Invite code',
        link: inviteSignupLink(invite.code),
        actionLabel: 'Create your practice',
      });
      delivered = result.success === true && !result.skipped;
    } catch (err) {
      this.logger.warn(`Invite ${invite.code} to ${email} failed: ${(err as Error).message}`);
    }

    const sent = await this.prisma.inviteSend.create({
      data: { inviteCodeId: existing.id, email, message, delivered, sentById },
    });
    if (!delivered) {
      throw new ServiceUnavailableException('The email could not be sent. Copy the invite link and share it another way.');
    }
    this.logger.log(`Invite ${invite.code} emailed to ${email}`);
    return this.sendView({ ...sent, sentBy: null });
  }

  async setActive(id: bigint, isActive: boolean) {
    const existing = await this.prisma.inviteCode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Invite code not found');
    await this.prisma.inviteCode.update({ where: { id }, data: { isActive: Boolean(isActive) } });
    return { id: id.toString(), isActive: Boolean(isActive) };
  }

  // ── Public and practice ────────────────────────────────────────────────

  /**
   * What a code would give, for the signup page to show before anyone commits.
   * Says only whether it is usable and what it grants: never who has used it.
   */
  async preview(rawCode: string) {
    const invite = await this.usable(normalizeInviteCode(rawCode));
    return { code: invite.code, tier: invite.tier, durationDays: invite.durationDays };
  }

  /** Throws the same way the redeem path does, so signup can check before creating anything. */
  async assertUsable(rawCode: string) {
    await this.usable(normalizeInviteCode(rawCode));
  }

  /**
   * Gives the practice the code's plan until durationDays from now.
   *
   * The use is claimed in one conditional UPDATE, so two practices redeeming
   * the last use of a code at the same moment cannot both get it: the second
   * matches no row.
   */
  async redeem(tenantId: bigint, rawCode: string, tx: Tx = this.prisma) {
    const code = normalizeInviteCode(rawCode);
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, inviteCodeId: true, subscriptionStatus: true },
    });
    if (!tenant) throw new NotFoundException('Practice tenant not found');
    if (tenant.inviteCodeId) {
      throw new BadRequestException('Your practice has already used an invite code.');
    }
    if (tenant.subscriptionStatus === 'active') {
      throw new BadRequestException('Your practice already has a paid plan, so an invite code is not needed.');
    }

    // Checked first only to give a precise reason; the claim below is what counts.
    await this.usable(code, tx);

    const claimed = await tx.$queryRaw<Array<{ id: bigint; tier: string; durationDays: number }>>`
      UPDATE "InviteCode"
         SET "usedCount" = "usedCount" + 1
       WHERE "code" = ${code}
         AND "isActive" = true
         AND ("redeemBy" IS NULL OR "redeemBy" > NOW())
         AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
      RETURNING "id", "tier", "durationDays"`;
    const invite = claimed[0];
    if (!invite) throw new BadRequestException('That invite code has just been used up.');

    const until = new Date(Date.now() + invite.durationDays * 24 * 60 * 60 * 1000);
    await tx.tenant.update({
      where: { id: tenantId },
      data: { subscriptionTier: invite.tier, complimentaryUntil: until, inviteCodeId: invite.id },
    });

    this.logger.log(`Tenant ${tenantId} redeemed invite ${code}: ${invite.tier} until ${until.toISOString()}`);
    return { tier: invite.tier, complimentaryUntil: until.toISOString() };
  }

  // ── Expiry ─────────────────────────────────────────────────────────────

  /**
   * Ends complimentary periods that have run out. A practice that started
   * paying in the meantime keeps its plan; only the end date is cleared.
   */
  async expireComplimentary(now = new Date()) {
    const due = await this.prisma.tenant.findMany({
      where: { complimentaryUntil: { lte: now } },
      select: { id: true, subscriptionStatus: true },
    });

    let downgraded = 0;
    for (const tenant of due) {
      const paying = tenant.subscriptionStatus === 'active';
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: paying ? { complimentaryUntil: null } : { subscriptionTier: 'STARTER', complimentaryUntil: null },
      });
      if (!paying) downgraded += 1;
    }

    if (due.length > 0) {
      this.logger.log(`Ended ${due.length} complimentary period(s); ${downgraded} moved back to Starter`);
    }
    return { ended: due.length, downgraded };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async usable(code: string, tx: Tx = this.prisma) {
    if (!code) throw new BadRequestException('Enter an invite code.');
    const invite = await tx.inviteCode.findUnique({ where: { code } });
    if (!invite || !invite.isActive) throw new BadRequestException('That invite code is not valid.');
    if (invite.redeemBy && invite.redeemBy <= new Date()) {
      throw new BadRequestException('That invite code has expired.');
    }
    if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
      throw new BadRequestException('That invite code has been fully used.');
    }
    return invite;
  }

  /** Readable, unambiguous: no 0/O or 1/I. */
  private generateCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(8);
    let out = '';
    for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
    return `DESK-${out.slice(0, 4)}-${out.slice(4)}`;
  }

  private view(c: {
    id: bigint;
    code: string;
    tier: string;
    durationDays: number;
    maxUses: number | null;
    usedCount: number;
    redeemBy: Date | null;
    note: string | null;
    isActive: boolean;
    createdAt: Date;
    tenants: Array<{ id: bigint; name: string; slug: string; subscriptionTier: string; complimentaryUntil: Date | null }>;
    sends: Array<Parameters<InviteService['sendView']>[0]>;
  }) {
    return {
      id: c.id.toString(),
      code: c.code,
      tier: c.tier,
      durationDays: c.durationDays,
      maxUses: c.maxUses,
      usedCount: c.usedCount,
      redeemBy: c.redeemBy?.toISOString() ?? null,
      note: c.note,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      practices: c.tenants.map((t) => ({
        id: t.id.toString(),
        name: t.name,
        slug: t.slug,
        tier: t.subscriptionTier,
        complimentaryUntil: t.complimentaryUntil?.toISOString() ?? null,
      })),
      sends: c.sends.map((send) => this.sendView(send)),
    };
  }

  private sendView(s: {
    id: bigint;
    email: string;
    message: string | null;
    delivered: boolean;
    createdAt: Date;
    sentBy: { email: string } | null;
  }) {
    return {
      id: s.id.toString(),
      email: s.email,
      message: s.message,
      delivered: s.delivered,
      sentBy: s.sentBy?.email ?? null,
      createdAt: s.createdAt.toISOString(),
    };
  }
}
