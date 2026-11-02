import { Injectable, OnModuleInit } from '@nestjs/common';
import { PROFILE_PUBLIC_ORIGIN } from '../../common/origins';
import { JobDeferredError, JobsService } from '../jobs/jobs.service';

export const PURGE_JOB = 'profile.purge';

export interface PurgePayload {
  tags: string[];
}

export const profileTag = (handle: string) => `profile:${handle}`;
export const SITEMAP_TAG = 'sitemap';

/**
 * Freshness (spec §6.12): after a published profile changes, its page is
 * purged from the profile site's cache. Workers Caching can only be purged
 * from inside the Worker that owns it, so this calls that Worker's
 * POST /api/purge with the shared PROFILES_PURGE_SECRET. A failure throws, so
 * the job runner retries with backoff and records the error; nothing is
 * swallowed. Without the secret (the site isn't deployed yet) the job waits.
 */
@Injectable()
export class ProfilePurgeJob implements OnModuleInit {
  constructor(private readonly jobs: JobsService) {}

  onModuleInit() {
    this.jobs.register(PURGE_JOB, (payload) => this.run(payload as PurgePayload));
  }

  async run(payload: PurgePayload): Promise<void> {
    const secret = process.env.PROFILES_PURGE_SECRET?.trim();
    if (!secret) throw new JobDeferredError('PROFILES_PURGE_SECRET is not set');
    const res = await fetch(`${PROFILE_PUBLIC_ORIGIN}/api/purge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-purge-secret': secret },
      body: JSON.stringify({ tags: payload.tags }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Profile site purge answered ${res.status}`);
  }
}
