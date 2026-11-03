import { describe, expect, it, vi } from 'vitest';
import { JobDeferredError } from '../jobs/jobs.service';
import { PURGE_JOB } from './profile-purge.job';
import { ProfilePreviewJob, initialsOf } from './profile-preview.job';

/** The database, bucket and job queue are the boundary; the renderer is the real one. */
function setup(over: Record<string, unknown> = {}, configured = true) {
  const profile = {
    id: 50n, handle: 'folake', status: 'PUBLISHED', displayName: 'Dr. Folake Adeyemi', kind: 'PSYCHOLOGIST',
    headline: 'Helping adults through anxiety.', city: 'Lagos', countryCode: 'NG', photoKey: null, previewImageKey: 'profiles/50/preview-old.png',
    layoutKey: 'editorial', themeKey: 'warm', ...over,
  };
  const prisma: any = {
    practitionerProfile: { findUnique: vi.fn().mockResolvedValue(profile), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const storage: any = {
    configured: vi.fn().mockReturnValue(configured),
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const jobs: any = { register: vi.fn(), enqueue: vi.fn().mockResolvedValue({ id: 9n }), runNow: vi.fn().mockResolvedValue(undefined) };
  return { job: new ProfilePreviewJob(prisma, storage, jobs), prisma, storage, jobs };
}

describe('link-preview job (§6.3)', () => {
  it('renders the card, swaps it in, removes the old one and purges the page', async () => {
    const { job, prisma, storage, jobs } = setup();
    await job.run({ practitionerProfileId: '50' });
    const [bucket, key, png, opts] = storage.put.mock.calls[0];
    expect(bucket).toBe('public');
    expect(key).toMatch(/^profiles\/50\/preview-[0-9a-f]{16}\.png$/);
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(opts).toEqual({ contentType: 'image/png' });
    expect(prisma.practitionerProfile.updateMany).toHaveBeenCalledWith({
      where: { id: 50n, previewImageKey: 'profiles/50/preview-old.png' },
      data: { previewImageKey: key },
    });
    expect(storage.remove).toHaveBeenCalledWith('public', 'profiles/50/preview-old.png');
    expect(jobs.enqueue).toHaveBeenCalledWith(PURGE_JOB, { tags: ['profile:folake'] }, expect.anything());
  });

  it('reads the photo from our own bucket by key', async () => {
    const { job, storage } = setup({ photoKey: 'profiles/50/photo-a.webp' });
    await job.run({ practitionerProfileId: '50' });
    expect(storage.get).toHaveBeenCalledWith('public', 'profiles/50/photo-a.webp');
  });

  it('drops its render when another one was swapped in meanwhile', async () => {
    const { job, prisma, storage, jobs } = setup();
    prisma.practitionerProfile.updateMany.mockResolvedValue({ count: 0 });
    await job.run({ practitionerProfileId: '50' });
    const key = storage.put.mock.calls[0][1];
    expect(storage.remove).toHaveBeenCalledWith('public', key);
    expect(storage.remove).not.toHaveBeenCalledWith('public', 'profiles/50/preview-old.png');
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it('skips profiles that are not published, and waits for storage', async () => {
    for (const status of ['DRAFT', 'HIDDEN', 'SUSPENDED']) {
      const { job, storage } = setup({ status });
      await job.run({ practitionerProfileId: '50' });
      expect(storage.put).not.toHaveBeenCalled();
    }
    const { job } = setup({}, false);
    await expect(job.run({ practitionerProfileId: '50' })).rejects.toBeInstanceOf(JobDeferredError);
  });

  it('makes initials that skip a title', () => {
    expect(initialsOf('Dr. Folake Adeyemi')).toBe('FA');
    expect(initialsOf('Amina')).toBe('A');
  });
});
