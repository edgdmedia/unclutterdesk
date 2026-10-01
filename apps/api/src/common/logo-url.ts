import { createHash } from 'crypto';
import { apiOrigin } from './origins';

const DATA_IMAGE = /^data:(image\/(?:png|jpeg|gif|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)$/;

/** Where a practice's logo can be loaded from outside the app, e.g. in an email. */
export function logoUrlFor(tenant: { id: bigint; logoUrl: string | null }): string | null {
  const logo = tenant.logoUrl?.trim();
  if (!logo) return null;
  if (/^https:\/\//i.test(logo)) return logo;
  if (!DATA_IMAGE.test(logo)) return null;
  const version = createHash('sha1').update(logo).digest('hex').slice(0, 8);
  return `${apiOrigin()}/v1/tenant/${tenant.id}/logo?v=${version}`;
}
