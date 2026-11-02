import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { safeEqual } from '../timing-safe';
import { normalizeHost } from '../normalize-host';

/**
 * Requests that came through the client API proxy on a practice custom
 * domain (spec §6.16). The tenant router adds these headers, after removing
 * any copy the browser sent; they must match apps/tenant-router/src/api-proxy.ts.
 */
export const ROUTER_SECRET_HEADER = 'x-ud-router-secret';
export const PRACTICE_HOST_HEADER = 'x-ud-practice-host';
export const CLIENT_IP_HEADER = 'x-ud-client-ip';

export interface RouterProxied {
  /** The custom domain the visitor is on, e.g. "chente.com". */
  practiceHost: string;
  /** The visitor's IP as Cloudflare gave it to the router, if any. */
  clientIp: string | null;
}

export interface RouterProxyRequest extends Request {
  routerProxy?: RouterProxied;
}

/** A plain IPv4 or IPv6 address, nothing else (it ends up as a rate-limit key). */
function cleanIp(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const ip = raw.trim();
  return /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : null;
}

/**
 * Trusts the router's headers only when they arrive with ROUTER_PROXY_SECRET
 * (compared timing-safe). Anyone can call the API directly and set any header,
 * so without the secret, or with a wrong one, the request is simply an
 * ordinary direct request: the headers are ignored, not rejected. Either way
 * they are removed, so nothing further down reads them unchecked.
 *
 * Log at debug level for secret mismatches to avoid log flooding from direct
 * callers who send the header without understanding it needs the secret.
 */
@Injectable()
export class RouterProxyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RouterProxyMiddleware.name);

  use(req: RouterProxyRequest, _res: Response, next: NextFunction) {
    const secret = process.env.ROUTER_PROXY_SECRET?.trim();
    const sent = req.headers[ROUTER_SECRET_HEADER];
    const host = req.headers[PRACTICE_HOST_HEADER];

    if (secret && safeEqual(sent, secret) && typeof host === 'string' && host.trim()) {
      req.routerProxy = { practiceHost: normalizeHost(host.trim()), clientIp: cleanIp(req.headers[CLIENT_IP_HEADER]) };
    } else if (sent !== undefined) {
      // Log at debug level for secret mismatches to avoid log flooding from direct callers
      if (!secret) {
        this.logger.warn(`Ignored router proxy headers: ROUTER_PROXY_SECRET is not configured`);
      } else if (!safeEqual(sent, secret)) {
        this.logger.debug(`Router proxy secret did not match`);
      } else if (typeof host !== 'string' || !host.trim()) {
        // Secret matched but host is blank - this is a router bug
        this.logger.warn(`Practice host header missing or empty`);
      } else {
        // Secret didn't match, but we already handled that above
        this.logger.debug(`Router proxy request ignored`);
      }
    }

    delete req.headers[ROUTER_SECRET_HEADER];
    delete req.headers[PRACTICE_HOST_HEADER];
    delete req.headers[CLIENT_IP_HEADER];
    next();
  }
}

/** The visitor's IP: the router's forwarded one on proxied requests, else Express's (via trust proxy). */
export function clientIpOf(req: { routerProxy?: RouterProxied; ip?: string }): string | undefined {
  return req.routerProxy?.clientIp ?? req.ip;
}
