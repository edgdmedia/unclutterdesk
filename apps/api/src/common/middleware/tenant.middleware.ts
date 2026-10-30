import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { RouterProxied } from './router-proxy.middleware';

export interface TenantRequest extends Request {
  tenant?: any;
  tenantId?: bigint;
  /** Set by RouterProxyMiddleware for requests proxied from a practice custom domain. */
  routerProxy?: RouterProxied;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: TenantRequest, res: Response, next: NextFunction) {
    // Explicitly ignore ambient tenant resolution for routes that strictly require body/query tenantId
    if (req.path === '/v1/discount/validate') {
      return next();
    }

    const host = req.headers['host'] || '';
    // A practice is named by its slug or address only. There used to be an
    // X-Tenant-Id header here as well: nothing sent it, it let a request pick
    // any practice by guessing an id, and a non-numeric value threw a 500.
    const tenantHeaderSlug = req.headers['x-tenant-slug'] as string;

    let tenant = null;

    if (req.routerProxy) {
      // Proxied from a custom domain (spec §6.16): the router named the
      // practice, and only an ACTIVE custom domain counts. Nothing the
      // browser sent can point the request at a different practice.
      tenant = await this.activeCustomDomain(req.routerProxy.practiceHost);
    } else if (tenantHeaderSlug) {
      // The app sends the practice it is serving, read from the page's own
      // address. Browsers call api.unclutterdesk.com, so the Host header here
      // never names a practice; without this, public booking calls could not
      // tell which practice they were for. On a practice's own domain the
      // "slug" the app reads is that whole domain.
      const key = tenantHeaderSlug.trim().toLowerCase();
      tenant = await this.prisma.tenant.findUnique({ where: { slug: key } });
      if (!tenant && key.includes('.')) {
        tenant = await this.activeCustomDomain(key);
      }
    } else if (host) {
      // Clean host (remove port)
      const domain = host.split(':')[0].toLowerCase();

      // Try exact custom domain first
      tenant = await this.activeCustomDomain(domain);

      // Otherwise check subdomain (e.g. "drjane.unclutterdesk.com" -> "drjane").
      // Local dev uses *.localhost, which has only two labels.
      if (!tenant && domain.includes('.')) {
        const parts = domain.split('.');
        const isLocalhostHost = parts[parts.length - 1] === 'localhost';
        if ((isLocalhostHost && parts.length >= 2) || (!isLocalhostHost && parts.length >= 3)) {
          const subdomain = parts[0];
          if (subdomain !== 'www' && subdomain !== 'app' && subdomain !== 'api') {
            tenant = await this.prisma.tenant.findUnique({
              where: { slug: subdomain },
            });
          }
        }
      }
    }

    if (tenant) {
      req.tenant = tenant;
      req.tenantId = tenant.id;
    }

    next();
  }

  /** A custom domain only stands for a practice once it has been verified. */
  private activeCustomDomain(domain: string) {
    return this.prisma.tenant.findFirst({
      where: { customDomain: domain, customDomainStatus: 'ACTIVE' },
    });
  }
}
