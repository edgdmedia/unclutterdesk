/**
 * apiClient.ts
 * Thin fetch wrapper for the Unclutter Desk NestJS API.
 *
 * SECURITY (httpOnly cookie auth):
 * - The access & refresh tokens live in httpOnly cookies set by the API.
 *   JS can never read them (immune to XSS via document.cookie).
 * - State-changing requests carry an X-CSRF-Token header sourced from a
 *   readable `unclutter_csrf` cookie (double-submit pattern).
 * - On a 401 the client tries POST /v1/auth/refresh (single-flight) and
 *   replays the original request once; if refresh fails, the session is
 *   torn down via a session-expired handler.
 */

const DEFAULT_API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : 'https://api.unclutterdesk.com';
const API_BASE = import.meta.env.VITE_API_URL || DEFAULT_API_BASE;

const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'os', 'admin', 'api', 'book', 'mail', 'docs', 'help', 'blog',
  'status', 'support', 'cdn', 'assets', 'static', 'dev', 'staging', 'test', 'demo', 'ns1', 'ns2'
]);

export function getAppType(): 'admin' | 'app' | 'booking' | 'marketing' {
  if (typeof window === 'undefined') return 'marketing';
  const host = window.location.hostname;
  
  if (host === 'admin.unclutterdesk.com' || host === 'admin.localhost') return 'admin';
  if (host === 'app.unclutterdesk.com' || host === 'app.localhost' || host === 'localhost') return 'app';
  if (host === 'unclutterdesk.com' || host === 'www.unclutterdesk.com') return 'marketing';
  
  return 'booking';
}

export function getSubdomainTenantSlug(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  
  // Local testing support (e.g. my-clinic.localhost)
  if (host.endsWith('.localhost')) {
    const slug = host.replace('.localhost', '');
    if (!RESERVED_SUBDOMAINS.has(slug) && slug !== 'localhost') {
      return slug;
    }
    return null;
  }

  // Production unclutterdesk.com subdomains
  if (host.endsWith('.unclutterdesk.com')) {
    const slug = host.replace('.unclutterdesk.com', '');
    if (!RESERVED_SUBDOMAINS.has(slug)) {
      return slug;
    }
    return null;
  }

  // Custom domains
  if (host !== 'localhost' && host !== 'unclutterdesk.com') {
    return host; // The backend should resolve the custom domain to a tenant slug
  }

  return null;
}

export const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG || getSubdomainTenantSlug() || '';

function resolveAppBase(): string {
  if (!import.meta.env.DEV || typeof window === 'undefined') return 'https://app.unclutterdesk.com';
  const { hostname, origin, port } = window.location;
  if (hostname === 'localhost' || hostname === 'app.localhost') return origin;
  return `http://localhost${port ? `:${port}` : ''}`;
}

const DEFAULT_APP_BASE = resolveAppBase();
export const APP_BASE_URL = import.meta.env.VITE_APP_URL || DEFAULT_APP_BASE;

export function getBookingUrl(slug: string): string {
  if (!slug) return APP_BASE_URL;
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return `http://${slug}.localhost${window.location.port ? `:${window.location.port}` : ''}`;
  }
  return `https://${slug}.unclutterdesk.com`;
}

const CSRF_COOKIE = 'unclutter_csrf';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const AUTH_PATHS = new Set([
  '/v1/auth/login',
  '/v1/auth/register',
  '/v1/auth/refresh',
  '/v1/auth/status',
]);

const AUTH_PUBLIC_PATHS = new Set([
  '/v1/auth/login',
  '/v1/auth/register',
  '/v1/auth/forgot-password',
  '/v1/auth/reset-password',
  '/v1/auth/verify-email',
  '/v1/auth/resend-verification',
]);

const PUBLIC_TENANT_PATH_PREFIXES = [
  '/v1/tenant/public/',
  '/v1/consult/public/',
  '/v1/intake/public/',
  '/v1/discount/validate',
];

type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler | null = null;

let refreshing: Promise<boolean> | null = null;

export function setSessionExpiredHandler(handler: SessionExpiredHandler): void {
  onSessionExpired = handler;
}

let memoryCsrfToken: string | null = null;

export function setMemoryCsrfToken(token: string) {
  memoryCsrfToken = token;
}

function getCsrfToken(): string | null {
  if (memoryCsrfToken) return memoryCsrfToken;
  const match = typeof document !== 'undefined' 
    ? document.cookie.split('; ').find((row) => row.startsWith(`${CSRF_COOKIE}=`))
    : null;
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : null;
}

function buildHeaders(
  extraHeaders: Record<string, string> | undefined,
  method = 'GET',
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders as Record<string, string>),
  };

  if (!SAFE_METHODS.has(method.toUpperCase())) {
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  return headers;
}

async function requestRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const response = await fetch(`${API_BASE}/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: buildHeaders(undefined, 'POST'),
        });
        if (response.ok) {
          const data = await response.json().catch(() => null);
          if (data && typeof data === 'object' && 'csrfToken' in data && typeof data.csrfToken === 'string') {
            memoryCsrfToken = data.csrfToken;
          }
        }
        return response.ok;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export async function clearSession(): Promise<void> {
  try {
    await fetch(`${API_BASE}/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: buildHeaders(undefined, 'POST'),
    });
  } catch {
    // Best-effort — the httpOnly cookies are invalidated server-side on expiry.
  }
}

// ── Fetch wrapper ──────────────────────────────────────────────────────────────

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

interface InternalRequestOptions extends RequestOptions {
  _retried?: boolean;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: InternalRequestOptions = {},
): Promise<T> {
  const { body, headers: extraHeaders, _retried, ...rest } = options;
  const method = rest.method || 'GET';
  const headers = buildHeaders(extraHeaders as Record<string, string> | undefined, method);

  const isPublicTenantPath = PUBLIC_TENANT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
  if (!('X-Tenant-Slug' in headers) && !AUTH_PUBLIC_PATHS.has(path) && !isPublicTenantPath && TENANT_SLUG) {
    headers['X-Tenant-Slug'] = TENANT_SLUG;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Session expired mid-flight — try to refresh once, then replay.
  if (response.status === 401 && !AUTH_PATHS.has(path) && !_retried) {
    const refreshed = await requestRefresh();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, _retried: true });
    }
    onSessionExpired?.();
    await clearSession();
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (!response.ok) {
    let message = `API error ${response.status}`;
    try {
      const err = await response.json();
      message = err?.message || message;
    } catch {
      // ignore JSON parse failure on error body
    }
    throw new Error(message);
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);
  if (data && typeof data === 'object' && 'csrfToken' in data && typeof data.csrfToken === 'string') {
    memoryCsrfToken = data.csrfToken;
  }
  return data as T;
}

// ── Shorthand helpers ─────────────────────────────────────────────────────────
export const api = {
  get: <T>(path: string) => apiRequest<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    apiRequest<T>(path, { method: 'POST', body, headers }),
  put: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    apiRequest<T>(path, { method: 'PUT', body, headers }),
  patch: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    apiRequest<T>(path, { method: 'PATCH', body, headers }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
