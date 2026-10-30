/**
 * The client API proxy on practice custom domains (spec §6.16).
 *
 * On `chente.com` the API's cookies would be third-party, which browsers
 * block, and the page can't read the CSRF cookie set for the platform domain,
 * so client sign-in and booking fail. Serving the client-facing API at
 * `chente.com/api/...` makes the cookies first-party:
 *
 * - only allow-listed client routes are forwarded (client-api-routes.json);
 *   admin, platform and dashboard routes are refused;
 * - the router tells the API which practice and which visitor this is in its
 *   own headers, after removing any copy the browser sent, and proves they
 *   came from the router with ROUTER_PROXY_SECRET;
 * - every Set-Cookie coming back loses its Domain (so it's host-only on the
 *   custom domain) and has Path=/v1/ rewritten to Path=/api/v1/ (the refresh
 *   cookie is scoped to /v1/auth/refresh, and is cleared on that path too).
 */
import routeList from './client-api-routes.json';

/** Headers only the router may set. Any incoming copy is removed first. */
export const ROUTER_SECRET_HEADER = 'x-ud-router-secret';
export const PRACTICE_HOST_HEADER = 'x-ud-practice-host';
export const CLIENT_IP_HEADER = 'x-ud-client-ip';
const ROUTER_HEADERS = [ROUTER_SECRET_HEADER, PRACTICE_HOST_HEADER, CLIENT_IP_HEADER];

export const API_PREFIX = '/api';

/** True for /api and anything under it: reserved on every practice host. */
export function isApiPath(pathname: string): boolean {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

interface AllowedRoute {
  method: string;
  pattern: RegExp;
}

function compile(entry: string): AllowedRoute {
  const [method, path] = entry.split(' ');
  const pattern = path
    .split('/')
    .map((segment) => (segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return { method: method.toUpperCase(), pattern: new RegExp(`^${pattern}/?$`) };
}

export const CLIENT_API_ROUTES: string[] = routeList.routes;
const ALLOWED = CLIENT_API_ROUTES.map(compile);

/**
 * Whether the router forwards `method apiPath` (the path without /api). HEAD
 * follows GET; a CORS preflight never happens (the page and /api share an
 * origin), so OPTIONS is refused like anything else not listed.
 */
export function isAllowedClientRoute(method: string, apiPath: string): boolean {
  const verb = method.toUpperCase() === 'HEAD' ? 'GET' : method.toUpperCase();
  return ALLOWED.some((r) => r.method === verb && r.pattern.test(apiPath));
}

/** `/api/v1/auth/login` → `/v1/auth/login`. */
export function stripApiPrefix(pathname: string): string {
  return pathname.slice(API_PREFIX.length) || '/';
}

/**
 * The request to send to the API: same method, body and headers, prefix
 * removed, router headers replaced with the router's own.
 */
export function apiRequest(
  request: Request,
  opts: { apiBase: string; practiceHost: string; secret: string | undefined },
): Request {
  const incoming = new URL(request.url);
  const target = new URL(stripApiPrefix(incoming.pathname) + incoming.search, opts.apiBase);

  const headers = new Headers(request.headers);
  for (const name of ROUTER_HEADERS) headers.delete(name);
  if (opts.secret) {
    headers.set(ROUTER_SECRET_HEADER, opts.secret);
    headers.set(PRACTICE_HOST_HEADER, opts.practiceHost);
    const clientIp = request.headers.get('cf-connecting-ip');
    if (clientIp) headers.set(CLIENT_IP_HEADER, clientIp);
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  return new Request(target.toString(), {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: 'manual',
    // The body streams through rather than being buffered. Workers streams
    // by default; the fetch standard (and Node, in the tests) wants it said.
    ...(hasBody ? { duplex: 'half' } : {}),
  } as RequestInit);
}

/** One Set-Cookie value, made to belong to the custom domain under /api. */
export function rewriteSetCookie(value: string): string {
  return value
    .split(';')
    .map((part) => part.trim())
    .filter((part) => !/^domain=/i.test(part))
    .map((part) => (/^path=\/v1(\/|$)/i.test(part) ? `Path=${API_PREFIX}${part.slice(part.indexOf('=') + 1)}` : part))
    .join('; ');
}

/**
 * Every Set-Cookie on a response, separately (they can't be joined with
 * commas). Workers offers getAll('set-cookie'); the standard getSetCookie()
 * is used where it exists (Node, for the tests).
 */
function setCookiesOf(headers: Headers): string[] {
  const h = headers as Headers & { getSetCookie?: () => string[]; getAll?: (name: string) => string[] };
  if (typeof h.getSetCookie === 'function') return h.getSetCookie();
  return h.getAll ? h.getAll('set-cookie') : [];
}

/** The API's response with every Set-Cookie rewritten; the body streams through. */
export function clientResponse(response: Response): Response {
  const cookies = setCookiesOf(response.headers);
  if (cookies.length === 0) return response;
  const headers = new Headers(response.headers);
  headers.delete('set-cookie');
  for (const cookie of cookies) headers.append('set-cookie', rewriteSetCookie(cookie));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** What /api answers when the router won't forward: plain JSON, never the app. */
export function apiNotFound(): Response {
  return new Response(JSON.stringify({ statusCode: 404, message: 'Not found' }), {
    status: 404,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
