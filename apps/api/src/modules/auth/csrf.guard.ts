import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE } from '../../common/auth.config';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Endpoints that cannot present a CSRF token because they run before one
 * exists — the token is issued *by* signing in.
 *
 * Matched on exact method and path. The previous implementation tested whether
 * the path *contained* one of a list of fragments, which exempted far more than
 * intended: '/invite' matched `POST /v1/tenant/staff/invite`, leaving the
 * endpoint that adds staff to a practice with no CSRF protection at all, and
 * '/register' matched `POST /v1/tenant/register`.
 *
 * `/v1/auth/refresh` is here on purpose. It is how a session is recovered, so
 * it has to work even when the readable CSRF cookie is missing while the
 * httpOnly session cookies survive — otherwise that state is an unrecoverable
 * logout loop. A forged refresh is not useful to an attacker: the rotated
 * tokens are set on the victim's own browser, and CORS prevents the response
 * from being read cross-origin.
 *
 * `/v1/auth/logout` is deliberately NOT exempt. The client sends the token on
 * it, and a forced logout is a real, if minor, nuisance attack.
 */
const EXEMPT_ROUTES = new Set([
  'POST /v1/auth/login',
  'POST /v1/auth/register',
  'POST /v1/auth/verify-email',
  'POST /v1/auth/resend-verification',
  'POST /v1/auth/forgot-password',
  'POST /v1/auth/reset-password',
  // Runs before the claimant has any session; the invite token is the credential.
  'POST /v1/auth/invite/claim',
  'POST /v1/auth/refresh',
  'POST /v1/admin/auth/login',
  'POST /v1/tenant/register',
]);

function normalisePath(raw: string): string {
  // Drop any query string and collapse a trailing slash, so that
  // `/v1/auth/login/` and `/v1/auth/login?x=1` cannot be used to slip past —
  // or accidentally miss — the exemption list.
  const path = raw.split('?')[0].split('#')[0];
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

function tokensMatch(header: unknown, cookie: unknown): boolean {
  // A repeated header arrives as an array; treat that as a failure rather than
  // trying to guess which value was meant.
  if (typeof header !== 'string' || typeof cookie !== 'string') return false;
  if (header.length === 0 || cookie.length === 0) return false;

  const a = Buffer.from(header, 'utf8');
  const b = Buffer.from(cookie, 'utf8');
  // timingSafeEqual throws on a length mismatch, and length is not secret.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const method = String(req.method || '').toUpperCase();

    if (SAFE_METHODS.has(method)) return true;

    const path = normalisePath(req.path || req.url || '');
    if (EXEMPT_ROUTES.has(`${method} ${path}`)) return true;

    // Escape hatch for local development only. Previously this was honoured in
    // every environment, so one stray variable on the production host would
    // have disabled CSRF protection platform-wide.
    if (process.env.NODE_ENV !== 'production' && process.env.DISABLE_CSRF === 'true') {
      return true;
    }

    // Without a session cookie there is nothing for an attacker's page to ride
    // on, so unauthenticated calls — public bookings, provider webhooks — pass.
    const hasSession = req.cookies?.[ACCESS_COOKIE] || req.cookies?.[REFRESH_COOKIE];
    if (!hasSession) return true;

    if (tokensMatch(req.headers?.['x-csrf-token'], req.cookies?.[CSRF_COOKIE])) {
      return true;
    }

    throw new ForbiddenException('Invalid CSRF token');
  }
}
