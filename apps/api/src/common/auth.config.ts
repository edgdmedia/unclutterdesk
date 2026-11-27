import { randomBytes } from 'crypto';
import { TENANT_ROOT_DOMAIN, tenantRootOf } from './origins';

const IS_PROD = process.env.NODE_ENV === 'production';

// The web app and API are served from different subdomains of the tenant
// root domain (or localhost ports in dev). In production the CSRF cookie is set
// for the root, so the app can read it on any subdomain. COOKIE_DOMAIN overrides.

// The root follows the API host the request came in on, so the old and new
// domains both work through a move (EXTRA_TENANT_ROOT_DOMAINS).
function cookieDomain(apiHostname?: string): string | undefined {
  if (process.env.COOKIE_DOMAIN) return process.env.COOKIE_DOMAIN;
  if (!IS_PROD) return undefined;
  return `.${(apiHostname && tenantRootOf(apiHostname)) || TENANT_ROOT_DOMAIN}`;
}

function resolveSecret(name: string): string {
  const fromEnv = process.env[name];
  if (fromEnv) return fromEnv;
  const generated = randomBytes(32).toString('hex');
  console.warn(
    `[auth] ${name} is not set — using an ephemeral random secret. Tokens will be invalidated on every restart. Set ${name} in production.`,
  );
  return generated;
}

export const JWT_SECRET = resolveSecret('JWT_SECRET');
export const REFRESH_SECRET = resolveSecret('REFRESH_SECRET');

export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
export const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || '30d';

export const ACCESS_COOKIE = 'unclutter_access';
export const REFRESH_COOKIE = 'unclutter_refresh';
export const CSRF_COOKIE = 'unclutter_csrf';

export const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000;
export const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
  domain?: string;
}

export function cookieOptions(maxAgeMs: number, path = '/'): CookieOptions {
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    path,
    maxAge: maxAgeMs,
  };
}

export function csrfCookieOptions(apiHostname?: string): CookieOptions {
  const domain = cookieDomain(apiHostname);
  return {
    ...cookieOptions(REFRESH_COOKIE_MAX_AGE),
    httpOnly: false,
    ...(domain ? { domain } : {}),
  };
}
