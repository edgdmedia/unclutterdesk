import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';

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

function secretMatches(sent: unknown, expected: string): boolean {
  if (typeof sent !== 'string' || sent.length === 0) return false;
  const a = Buffer.from(sent, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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
 */
@Injectable()
export class RouterProxyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RouterProxyMiddleware.name);

  use(req: RouterProxyRequest, _res: Response, next: NextFunction) {
    const secret = process.env.ROUTER_PROXY_SECRET?.trim();
    const sent = req.headers[ROUTER_SECRET_HEADER];
    const host = req.headers[PRACTICE_HOST_HEADER];

    if (secret && secretMatches(sent, secret) && typeof host === 'string' && host.trim()) {
      req.routerProxy = { practiceHost: host.trim().toLowerCase(), clientIp: cleanIp(req.headers[CLIENT_IP_HEADER]) };
    } else if (sent !== undefined) {
      this.logger.warn(`Ignored router proxy headers on ${req.method} ${req.path}: secret ${secret ? 'did not match' : 'is not configured'}`);
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
