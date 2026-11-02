import { env } from 'cloudflare:workers';
import { profilesConfig, type ProfilesEnv, type ProfilesConfig } from './config';

/** This Worker's config, from its vars. */
export function config(): ProfilesConfig {
  return profilesConfig(env as unknown as ProfilesEnv);
}
