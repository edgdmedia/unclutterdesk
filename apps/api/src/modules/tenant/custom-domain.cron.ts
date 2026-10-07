import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CloudflareSaasService } from './cloudflare-saas.service';
import { TenantService } from './tenant.service';

/**
 * SET-13: the patient half of custom domains.
 *
 * Provisioning ends with a hostname that only the practice can complete — by
 * pointing its DNS at us and waiting for Cloudflare to issue the certificate.
 * This cron notices: it promotes verified domains, retries domains whose
 * first provisioning attempt failed (quota blips, a dead token that came
 * back), and sweeps hostname objects whose owning tenant has moved on.
 *
 * Nothing here can mark a domain ACTIVE without Cloudflare saying both the
 * hostname and its certificate are active — the same rule the verify button
 * obeys, applied on a timer.
 */
@Injectable()
export class CustomDomainCron {
  private readonly logger = new Logger(CustomDomainCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cf: CloudflareSaasService,
    private readonly tenantService: TenantService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async tick(): Promise<void> {
    if (!this.cf.configured()) return;
    await this.promoteVerified();
    await this.retryUnprovisioned();
    await this.sweepOrphans();
  }

  private async promoteVerified(): Promise<void> {
    const waiting = await this.prisma.tenant.findMany({
      where: { customHostnameId: { not: null }, customDomainStatus: { not: 'ACTIVE' } },
      select: { id: true, customDomain: true, customHostnameId: true },
    });

    for (const tenant of waiting) {
      try {
        const verdict = await this.cf.getStatus(tenant.customHostnameId!);
        if (verdict.status === 'active' && verdict.sslStatus === 'active') {
          await this.prisma.tenant.update({
            where: { id: tenant.id },
            data: { customDomainStatus: 'ACTIVE', customHostnameError: null },
          });
          this.logger.log(`Custom domain ${tenant.customDomain} verified for tenant ${tenant.id}`);
        }
      } catch (err) {
        this.logger.warn(`poll ${tenant.customHostnameId} failed: ${(err as Error).message}`);
      }
    }
  }

  private async retryUnprovisioned(): Promise<void> {
    const stuck = await this.prisma.tenant.findMany({
      where: { customDomain: { not: null }, customHostnameId: null, customDomainStatus: 'PENDING' },
      select: { id: true, customDomain: true },
    });

    for (const tenant of stuck) {
      if (!tenant.customDomain) continue;
      try {
        await this.tenantService.provisionCustomDomain(tenant.id, tenant.customDomain, {
          customDomain: null,
          customHostnameId: null,
        });
      } catch (err) {
        this.logger.warn(`retry for tenant ${tenant.id} failed: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Delete hostname objects no tenant claims. Custom metadata is an
   * Enterprise add-on (error 1413), so ownership is decided by matching the
   * hostname against every tenant's stored customDomain: a hostname nobody
   * names is left over from a moved-away or cleared domain. Hostnames we do
   * not recognise as ours but a tenant does name are left alone — adopting
   * them is a manual step, deleting them would be vandalism.
   */
  private async sweepOrphans(): Promise<void> {
    let hostnames: Array<{ id: string; hostname: string }>;
    try {
      hostnames = await this.cf.listHostnames();
    } catch (err) {
      this.logger.warn(`listing hostnames failed: ${(err as Error).message}`);
      return;
    }
    if (!hostnames.length) return;

    const claimed = await this.prisma.tenant.findMany({
      where: { customDomain: { in: hostnames.map((h) => h.hostname) } },
      select: { customDomain: true },
    });
    const claimedNames = new Set(claimed.map((t: { customDomain: string | null }) => t.customDomain));

    for (const hostname of hostnames) {
      if (claimedNames.has(hostname.hostname)) continue;
      try {
        await this.cf.deleteHostname(hostname.id);
        await this.cf.removeRoute(hostname.hostname);
        this.logger.log(`swept orphan custom hostname ${hostname.hostname}`);
      } catch (err) {
        this.logger.warn(`sweep of ${hostname.hostname} failed: ${(err as Error).message}`);
      }
    }
  }
}
