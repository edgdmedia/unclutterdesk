import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { clientIpOf } from './middleware/router-proxy.middleware';

/**
 * Rate limits per visitor. On requests proxied from a practice custom domain
 * every request reaches the API from the tenant router, so Express's req.ip
 * would put every client on every custom domain in one bucket (login allows
 * 5 a minute). The router's forwarded IP, trusted only with the secret, keeps
 * them apart (spec §6.16).
 */
@Injectable()
export class ProxyAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return clientIpOf(req) ?? 'unknown';
  }
}
