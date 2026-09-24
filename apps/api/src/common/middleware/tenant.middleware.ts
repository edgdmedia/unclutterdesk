import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export interface TenantRequest extends Request {
  tenant?: any;
  tenantId?: bigint;
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
    const tenantHeaderId = req.headers['x-tenant-id'] as string;
    const tenantHeaderSlug = req.headers['x-tenant-slug'] as string;

    let tenant = null;

    if (tenantHeaderId) {
      tenant = await this.prisma.tenant.findUnique({
        where: { id: BigInt(tenantHeaderId) },
      });
    } else if (tenantHeaderSlug) {
      tenant = await this.prisma.tenant.findUnique({
        where: { slug: tenantHeaderSlug.toLowerCase() },
      });
    } else if (host) {
      // Clean host (remove port)
      const domain = host.split(':')[0].toLowerCase();
      
      // Try exact custom domain first
      tenant = await this.prisma.tenant.findUnique({
        where: { customDomain: domain },
      });

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
}
