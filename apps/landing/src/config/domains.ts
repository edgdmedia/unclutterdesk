/**
 * The marketing site's one domain config (spec §4.1a).
 *
 * Every production address is a build setting with today's address as its
 * default, so the move to new domains (§4.1b) is a change of settings, not of
 * copy. No other landing file may spell out a production domain: the API's
 * domain-literals.spec.ts checks the whole repository. `site` in
 * astro.config.mjs reads the same PUBLIC_MARKETING_URL.
 */

const trimSlash = (value: string) => value.replace(/\/+$/, '');
const env = import.meta.env;

/** This site. PUBLIC_MARKETING_URL. */
export const MARKETING_ORIGIN = trimSlash(env.PUBLIC_MARKETING_URL || 'https://unclutterdesk.com');

/** Sign-in and dashboard. PUBLIC_APP_URL. */
export const APP_ORIGIN = trimSlash(env.PUBLIC_APP_URL || 'https://app.unclutterdesk.com');

/** Practice subdomains are `{slug}.<root>`. PUBLIC_TENANT_ROOT_DOMAIN. */
export const TENANT_ROOT_DOMAIN = env.PUBLIC_TENANT_ROOT_DOMAIN || 'unclutterdesk.com';

/** What Pro practices point their own domain's CNAME at. PUBLIC_CUSTOM_DOMAIN_TARGET. */
export const CUSTOM_DOMAIN_TARGET = env.PUBLIC_CUSTOM_DOMAIN_TARGET || 'customers.unclutterdesk.com';

/** The domain of the published contact mailboxes. PUBLIC_CONTACT_EMAIL_DOMAIN. */
const CONTACT_EMAIL_DOMAIN = env.PUBLIC_CONTACT_EMAIL_DOMAIN || 'unclutterdesk.com';

export const SUPPORT_EMAIL = `support@${CONTACT_EMAIL_DOMAIN}`;
export const PRIVACY_EMAIL = `privacy@${CONTACT_EMAIL_DOMAIN}`;
export const SECURITY_EMAIL = `security@${CONTACT_EMAIL_DOMAIN}`;
