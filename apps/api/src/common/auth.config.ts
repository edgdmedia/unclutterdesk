import { randomBytes } from 'crypto';

const IS_PROD = process.env.NODE_ENV === 'production';

// The web app (app.unclutterdesk.com) and API (api.unclutterdesk.com) are
// served from different subdomains (or localhost ports in dev).

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || (IS_PROD ? '.unclutterdesk.com' : undefined);

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

export function csrfCookieOptions(): CookieOptions {
  return {
    ...cookieOptions(REFRESH_COOKIE_MAX_AGE),
    httpOnly: false,
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  };
}
