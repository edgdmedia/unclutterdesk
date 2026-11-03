/**
 * The profiles site's one domain config (spec §4.1a). The values come from
 * the Worker's vars (wrangler.jsonc); these defaults are today's addresses.
 * No other file in apps/profiles may spell out a production domain
 * (apps/api/src/domain-literals.spec.ts).
 */
export interface ProfilesEnv {
  PROFILE_PUBLIC_URL?: string;
  API_URL?: string;
  APP_URL?: string;
  MEDIA_URL?: string;
  MARKETING_URL?: string;
}

export interface ProfilesConfig {
  /** This site: https://therapysts.com (profiles moved straight to their target domain, §4.1b). */
  publicOrigin: string;
  /** Where the server renderer reads the public API. Never called from the browser with credentials. */
  apiOrigin: string;
  /** The app, for "Create your free therapist profile". */
  appOrigin: string;
  /** Public R2 files (photos, preview images). Null until R2 is set up. */
  mediaOrigin: string | null;
  marketingOrigin: string;
}

const trim = (v: string) => v.replace(/\/+$/, '');

export function profilesConfig(env: ProfilesEnv): ProfilesConfig {
  return {
    publicOrigin: trim(env.PROFILE_PUBLIC_URL || 'https://therapysts.com'),
    apiOrigin: trim(env.API_URL || 'https://api.unclutterdesk.com'),
    appOrigin: trim(env.APP_URL || 'https://app.unclutterdesk.com'),
    mediaOrigin: env.MEDIA_URL ? trim(env.MEDIA_URL) : null,
    marketingOrigin: trim(env.MARKETING_URL || 'https://unclutterdesk.com'),
  };
}
