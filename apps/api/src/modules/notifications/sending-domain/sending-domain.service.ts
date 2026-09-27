import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PRACTICE_ADMIN } from '../../../common/roles';
import { isPlatformHostname } from '../../tenant/reserved-slugs';
import { MailService } from '../mail/mail.service';
import { ResendDnsRecord, ResendDomain, ResendError } from '../mail/resend.client';
import { NotificationService } from '../notification.service';

const HOSTNAME = /^(?=.{1,100}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const LOCAL_PART = /^[a-z0-9](?:[a-z0-9._-]{0,38}[a-z0-9])?$/;

/** The DNS rows shown to the practice. Only what they need to copy. */
export interface SendingDnsRecord {
  purpose: string;
  type: string;
  name: string;
  value: string;
  priority?: number;
  status: string;
}

export function normaliseStatus(status: string | undefined | null): string {
  return (status || 'not_started').toUpperCase();
}

export function toDnsRecords(records: ResendDnsRecord[] | undefined): SendingDnsRecord[] {
  return (records ?? [])
    // Receiving records only matter for inbound mail, which Desk does not use.
    .filter((r) => r.record !== 'Receiving')
    .map((r) => ({
      purpose: r.record,
      type: r.type,
      name: r.name,
      value: r.value,
      ...(r.priority != null ? { priority: r.priority } : {}),
      status: normaliseStatus(r.status),
    }));
}

export function validateSendingDomain(input: string | undefined | null): string {
  const value = (input ?? '').trim().toLowerCase().replace(/\.$/, '');
  if (!value) throw new BadRequestException('Enter the domain you want to send from, e.g. mail.yourpractice.com');
  if (/^https?:\/\//.test(value) || value.includes('/') || value.includes('@')) {
    throw new BadRequestException('Enter a domain only, e.g. mail.yourpractice.com, without http:// or an email address');
  }
  if (isPlatformHostname(value)) {
    throw new BadRequestException('That domain belongs to Unclutter Desk. Use a domain your practice owns.');
  }
  if (!HOSTNAME.test(value)) throw new BadRequestException('Enter a valid domain, e.g. mail.yourpractice.com');
  return value;
}

export function validateLocalPart(input: string | undefined | null): string {
  const value = (input ?? '').trim().toLowerCase();
  if (!LOCAL_PART.test(value)) {
    throw new BadRequestException('The sender name before the @ can use letters, numbers, dots, dashes and underscores.');
  }
  return value;
}

/**
 * A practice's own sending domain (layer 2 of email). The practice adds the
 * DNS records Resend gives us; once Resend reports VERIFIED, MailService sends
 * that practice's mail from it. Any other status falls back to the platform
 * sender, so a DNS mistake never stops email.
 */
@Injectable()
export class SendingDomainService {
  private readonly logger = new Logger(SendingDomainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationService,
  ) {}

  async get(tenantId: bigint) {
    const row = await this.prisma.tenantSendingDomain.findUnique({ where: { tenantId } });
    return this.view(row);
  }

  async register(tenantId: bigint, dto: { domain?: string; fromLocalPart?: string }) {
    const resend = this.requireResend();
    const domain = validateSendingDomain(dto.domain);
    const fromLocalPart = dto.fromLocalPart ? validateLocalPart(dto.fromLocalPart) : 'notifications';

    const existing = await this.prisma.tenantSendingDomain.findUnique({ where: { tenantId } });
    if (existing) {
      throw new ConflictException(`This practice already sends from ${existing.domain}. Remove it first to use another domain.`);
    }
    const taken = await this.prisma.tenantSendingDomain.findUnique({ where: { domain }, select: { id: true } });
    if (taken) throw new ConflictException('Another practice is already using that domain.');

    let created: ResendDomain;
    try {
      created = await resend.createDomain(domain);
    } catch (err) {
      throw this.providerError(err, 'register the domain');
    }

    const row = await this.prisma.tenantSendingDomain.create({
      data: {
        tenantId,
        domain,
        fromLocalPart,
        resendDomainId: created.id,
        status: normaliseStatus(created.status),
        records: toDnsRecords(created.records) as unknown as Prisma.InputJsonValue,
        lastCheckedAt: new Date(),
      },
    });
    return this.view(row);
  }

  /** Asks Resend to re-check the DNS, then records what it currently reports. */
  async verify(tenantId: bigint) {
    const resend = this.requireResend();
    const row = await this.requireRow(tenantId);
    try {
      await resend.verifyDomain(row.resendDomainId);
    } catch (err) {
      throw this.providerError(err, 'check the domain');
    }
    return this.refresh(tenantId);
  }

  /** Pulls the current status and records from Resend without re-triggering a check. */
  async refresh(tenantId: bigint) {
    const resend = this.requireResend();
    const row = await this.requireRow(tenantId);
    let remote: ResendDomain;
    try {
      remote = await resend.getDomain(row.resendDomainId);
    } catch (err) {
      throw this.providerError(err, 'read the domain');
    }
    const updated = await this.applyStatus(row, remote.status, remote.records);
    return this.view(updated);
  }

  async updateSender(tenantId: bigint, dto: { fromLocalPart?: string }) {
    const row = await this.requireRow(tenantId);
    const fromLocalPart = validateLocalPart(dto.fromLocalPart);
    const updated = await this.prisma.tenantSendingDomain.update({ where: { id: row.id }, data: { fromLocalPart } });
    return this.view(updated);
  }

  async remove(tenantId: bigint) {
    const row = await this.requireRow(tenantId);
    const resend = this.mail.resend();
    if (resend) {
      try {
        await resend.removeDomain(row.resendDomainId);
      } catch (err) {
        // Already gone on Resend's side is fine; anything else is logged, and
        // the practice still gets its row removed so mail falls back at once.
        if (!(err instanceof ResendError && err.status === 404)) {
          this.logger.warn(`Could not remove Resend domain ${row.resendDomainId}: ${(err as Error).message}`);
        }
      }
    }
    await this.prisma.tenantSendingDomain.delete({ where: { id: row.id } });
    return this.view(null);
  }

  /**
   * Resend's domain.updated / domain.deleted webhook. The payload has already
   * been signature-checked by the controller.
   */
  async handleWebhook(event: { type?: string; data?: { id?: string; status?: string; records?: ResendDnsRecord[] } }) {
    const id = event?.data?.id;
    if (!id) return { handled: false };
    const row = await this.prisma.tenantSendingDomain.findUnique({ where: { resendDomainId: id } });
    if (!row) return { handled: false };

    if (event.type === 'domain.deleted') {
      await this.prisma.tenantSendingDomain.delete({ where: { id: row.id } });
      await this.tellAdmins(row.tenantId, 'Your sending domain was removed', `Email now goes out from Unclutter Desk's address instead of ${row.domain}.`);
      return { handled: true };
    }
    if (event.type === 'domain.updated' || event.type === 'domain.created') {
      await this.applyStatus(row, event.data?.status, event.data?.records);
      return { handled: true };
    }
    return { handled: false };
  }

  // ── Helpers ──

  private async applyStatus(
    row: { id: bigint; tenantId: bigint; domain: string; status: string; verifiedAt: Date | null },
    rawStatus: string | undefined,
    records: ResendDnsRecord[] | undefined,
  ) {
    const status = normaliseStatus(rawStatus);
    const wasVerified = row.status === 'VERIFIED';
    const isVerified = status === 'VERIFIED';

    const updated = await this.prisma.tenantSendingDomain.update({
      where: { id: row.id },
      data: {
        status,
        ...(records ? { records: toDnsRecords(records) as unknown as Prisma.InputJsonValue } : {}),
        lastCheckedAt: new Date(),
        ...(isVerified && !row.verifiedAt ? { verifiedAt: new Date() } : {}),
      },
    });

    if (!wasVerified && isVerified) {
      await this.tellAdmins(row.tenantId, `Email now sends from ${row.domain}`, `Your practice's email now goes out from ${updated.fromLocalPart}@${row.domain}.`);
    } else if (wasVerified && !isVerified) {
      await this.tellAdmins(
        row.tenantId,
        `Email from ${row.domain} has paused`,
        `The DNS records for ${row.domain} are no longer found, so email is going out from Unclutter Desk's address until they are fixed. Check the records in Brand settings.`,
      );
    }
    return updated;
  }

  private async tellAdmins(tenantId: bigint, title: string, message: string) {
    try {
      const admins = await this.prisma.profile.findMany({
        where: { tenantId, role: { in: PRACTICE_ADMIN }, status: 'active' },
        select: { id: true },
      });
      if (!admins.length) return;
      await this.notifications.notify({
        tenantId,
        profileIds: admins.map((a) => a.id),
        type: 'settings.sending_domain',
        title,
        message,
        link: '/dashboard/settings/brand',
        actionLabel: 'Open Brand settings',
      });
    } catch (err) {
      this.logger.warn(`Could not notify practice ${tenantId} about its sending domain: ${(err as Error).message}`);
    }
  }

  private view(
    row: {
      domain: string;
      status: string;
      records: Prisma.JsonValue;
      fromLocalPart: string;
      verifiedAt: Date | null;
      lastCheckedAt: Date | null;
    } | null,
  ) {
    const available = this.mail.resend() !== null;
    const platformSender = this.mail.platformSenderAddress();
    if (!row) return { available, platformSender, domain: null, sendingFrom: platformSender };
    const verified = row.status === 'VERIFIED';
    return {
      available,
      platformSender,
      domain: row.domain,
      status: row.status,
      fromLocalPart: row.fromLocalPart,
      fromAddress: `${row.fromLocalPart}@${row.domain}`,
      /** The address mail actually goes out from right now. */
      sendingFrom: verified && available ? `${row.fromLocalPart}@${row.domain}` : platformSender,
      records: (Array.isArray(row.records) ? row.records : []) as unknown as SendingDnsRecord[],
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    };
  }

  private requireResend() {
    const resend = this.mail.resend();
    if (!resend) {
      throw new ServiceUnavailableException('Sending from your own domain is not available yet. Email still goes out from Unclutter Desk.');
    }
    return resend;
  }

  private async requireRow(tenantId: bigint) {
    const row = await this.prisma.tenantSendingDomain.findUnique({ where: { tenantId } });
    if (!row) throw new NotFoundException('This practice has no sending domain set up.');
    return row;
  }

  private providerError(err: unknown, action: string) {
    this.logger.warn(`Resend could not ${action}: ${(err as Error).message}`);
    if (err instanceof ResendError && err.status >= 400 && err.status < 500 && err.status !== 401 && err.status !== 403) {
      return new BadRequestException(err.message);
    }
    return new ServiceUnavailableException(`We could not ${action} right now. Try again in a few minutes.`);
  }
}
