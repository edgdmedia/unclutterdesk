import { TENANT_ROOT_DOMAIN } from '../../common/origins';

/**
 * Every practice is served at `<slug>.<tenant root domain>`, so a slug is also a
 * subdomain. These names belong to the platform — our own services, mail and
 * nameservers, or words a client could mistake for us — and no practice may
 * hold one.
 *
 * `demo` is here too. The demo workspace already owns it; the check below lets
 * a tenant keep the slug it has, so that workspace is unaffected while nobody
 * else can take it.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'www',
  'app',
  'api',
  'admin',
  'book',
  'mail',
  'email',
  'smtp',
  'ns1',
  'ns2',
  'support',
  'help',
  'status',
  'docs',
  'blog',
  'billing',
  'pay',
  'payments',
  'auth',
  'login',
  'signup',
  'account',
  'dashboard',
  'portal',
  'static',
  'assets',
  'cdn',
  'dev',
  'staging',
  'test',
  'demo',
  'unclutter',
  'unclutterdesk',
]);

/** The one normalisation every slug path uses, so they cannot disagree. */
export function normalizeSlug(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(normalizeSlug(slug));
}

/**
 * A custom domain is the practice's own domain. Anything under ours is either
 * a reserved name or another practice's address, so none of it qualifies.
 */
export function isPlatformHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();
  return host === TENANT_ROOT_DOMAIN || host.endsWith(`.${TENANT_ROOT_DOMAIN}`) || host === 'localhost';
}
